"""Command-line entry point: `ai-drews --help`."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Annotated

import typer

from ai_drews.config import DEFAULT_CONFIG, DataPaths

app = typer.Typer(
    help="AI-DREWS pipeline: data -> features -> ENSO model -> drought model -> risk maps.",
    no_args_is_help=True,
)
train_app = typer.Typer(help="Train models.", no_args_is_help=True)
app.add_typer(train_app, name="train")

DataDir = Annotated[
    Path | None, typer.Option("--data-dir", "-d", help="Data root (default: $AI_DREWS_DATA_DIR or ./data)")
]


def _paths(data_dir: Path | None) -> DataPaths:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    return DataPaths.from_env(data_dir).ensure()


@app.command()
def ingest(
    source: Annotated[
        str,
        typer.Argument(
            help="One of: nino34, era5, ndvi, chirps, crops, validation, assemble, all",
        ),
    ] = "all",
    data_dir: DataDir = None,
) -> None:
    """Step 0: download the study's observational inputs into raw/.

    Every source is public and needs no credentials. `all` downloads each in turn and then
    assembles raw/grids.npz and raw/nino_indices.csv from them.
    """
    from ai_drews.ingest import ALL_CONNECTORS, build, fetch_all

    paths = _paths(data_dir)
    if source == "all":
        results = fetch_all(paths)
    elif source == "assemble":
        results = {build.KEY: build.assemble(paths)}
    elif source in ALL_CONNECTORS:
        results = {source: ALL_CONNECTORS[source](paths, DEFAULT_CONFIG)}
    else:
        choices = ", ".join([*ALL_CONNECTORS, "assemble", "all"])
        raise typer.BadParameter(f"unknown source {source!r}; choose one of: {choices}")

    for key, manifest in results.items():
        typer.echo(
            f"{key:11} {manifest.records:>6} records  "
            f"{manifest.coverage_start or '-'}..{manifest.coverage_end or '-'}  {manifest.provider}"
        )


@app.command("data-sources")
def data_sources(data_dir: DataDir = None) -> None:
    """What is currently supplying this deployment, read from the ingest manifests."""
    from ai_drews.ingest import read_manifests

    manifests = read_manifests(_paths(data_dir))
    if not manifests:
        typer.echo("no sources ingested; run `ai-drews ingest all`")
        raise typer.Exit(code=1)
    for key, manifest in sorted(manifests.items()):
        typer.echo(
            f"{key:11} {manifest.records:>6} records  "
            f"{manifest.coverage_start or '-'}..{manifest.coverage_end or '-'}  "
            f"retrieved {manifest.retrieved_at}"
        )


@app.command("grid-geojson")
def grid_geojson_cmd(data_dir: DataDir = None) -> None:
    """Write the forecast grid as one polygon per cell, for choropleth maps.

    A pin map puts identical dots on the watershed and encodes nothing. This is what a BI tool
    shades by probability; join it on `cell` (r{row}c{col}).
    """
    from ai_drews.geo.watershed import load_boundary, write_grid_geojson

    paths = _paths(data_dir)
    boundary = load_boundary(paths.watershed_geojson) if paths.watershed_geojson.exists() else None
    if boundary is None:
        typer.echo("warning: no catchment outline; every cell will be marked in_watershed")
    out = write_grid_geojson(
        paths.root / "geo" / "choke_grid.geojson",
        DEFAULT_CONFIG.rows,
        DEFAULT_CONFIG.cols,
        DEFAULT_CONFIG.bbox,
        boundary,
    )
    typer.echo(f"{out} ({DEFAULT_CONFIG.rows}x{DEFAULT_CONFIG.cols} cells)")


@app.command("build-data")
def build_data(data_dir: DataDir = None) -> None:
    """Step 1: load real raw data if present, otherwise write synthetic stand-in data."""
    from ai_drews.data.io import build_dataset

    typer.echo(build_dataset(_paths(data_dir)))


@app.command("build-features")
def build_features(data_dir: DataDir = None) -> None:
    """Step 2: SPI-3, VCI, anomalies, Fourier inputs -> processed/fields.npz."""
    from ai_drews.features.fields import build_features as _build

    typer.echo(_build(_paths(data_dir)))


@train_app.command("enso")
def train_enso(data_dir: DataDir = None, no_plot: bool = False) -> None:
    """Step 3 (Objective 1): CNN-LSTM Nino3.4 forecast vs persistence / Ridge."""
    from ai_drews.training.enso import train_enso as _train

    typer.echo(_train(_paths(data_dir), plot=not no_plot).to_string(index=False))


@train_app.command("drought")
def train_drought(
    data_dir: DataDir = None,
    data_source: Annotated[
        str, typer.Option(help="Recorded in drought_meta.json: real | synthetic")
    ] = "unknown",
) -> None:
    """Step 4 (Objective 2): SuperHybrid drought probability model."""
    from ai_drews.training.drought import train_drought as _train

    typer.echo(_train(_paths(data_dir), data_source=data_source).to_string(index=False))


@app.command("maps")
def maps(data_dir: DataDir = None, no_plot: bool = False) -> None:
    """Step 5: risk maps for the latest month -> outputs/latest_risk.npz, outputs/risk_maps.png."""
    from ai_drews.training.maps import render_risk_maps

    P = render_risk_maps(_paths(data_dir), plot=not no_plot)
    typer.echo(f"basin-mean probability by lead: {P.mean((1, 2)).round(3).tolist()}")


@app.command("run-all")
def run_all(data_dir: DataDir = None, no_plot: bool = False) -> None:
    """Run steps 1-5 in order."""
    from ai_drews.data.io import build_dataset
    from ai_drews.features.fields import build_features as _features
    from ai_drews.training.drought import train_drought as _drought
    from ai_drews.training.enso import train_enso as _enso
    from ai_drews.training.maps import render_risk_maps

    paths = _paths(data_dir)
    summary = build_dataset(paths)
    _features(paths)
    _enso(paths, plot=not no_plot)
    _drought(paths, data_source=summary["source"])
    render_risk_maps(paths, plot=not no_plot)
    typer.echo("pipeline complete")


@app.command()
def scenario(
    netcdf: Annotated[Path, typer.Argument(help="CMIP6 monthly NetCDF (ScenarioMIP, e.g. ssp585)")],
    data_dir: DataDir = None,
    lon_min: float = 35.5,
    lat_min: float = 8.5,
    lon_max: float = 40.5,
    lat_max: float = 13.5,
    latitude: Annotated[float, typer.Option(help="Representative latitude for daylight correction")] = 10.8,
) -> None:
    """Long-horizon drought outlook from a climate projection.

    This is NOT the operational forecast. It reads a scenario run and reports how drought
    intensity drifts over decades, writing the monthly series to outputs/ for plotting.
    """
    from ai_drews.analysis.scenario import scenario_outlook
    from ai_drews.data.cmip6 import load_projection

    paths = _paths(data_dir)
    projection = load_projection(netcdf, (lon_min, lat_min, lon_max, lat_max))
    outlook, frame = scenario_outlook(projection, latitude_deg=latitude)

    stem = f"{projection.source_id}_{projection.experiment_id}".replace("/", "-")
    frame.to_csv(paths.outputs / f"scenario_{stem}.csv", index=False)
    (paths.outputs / f"scenario_{stem}.json").write_text(json.dumps(outlook.to_dict(), indent=2))

    typer.echo(outlook.summary())
    typer.echo(f"\nwarming     {outlook.warming_c_per_decade:+.2f} C per decade")
    typer.echo(
        f"rainfall    {outlook.annual_precip_mm_baseline:.0f} -> "
        f"{outlook.annual_precip_mm_final_decade:.0f} mm/yr"
    )
    if outlook.footprint_warning:
        typer.secho(f"\n{outlook.footprint_warning}", fg=typer.colors.YELLOW)
    typer.secho(f"\n{outlook.caveat}", fg=typer.colors.YELLOW)
    typer.echo(f"\nwrote outputs/scenario_{stem}.csv and .json")


@app.command("version")
def version() -> None:
    from ai_drews import __version__
    from ai_drews.advisory import RULES_VERSION

    typer.echo(f"ai-drews {__version__} | advisory rules {RULES_VERSION}")


if __name__ == "__main__":
    app()
