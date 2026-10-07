export type Language = 'en' | 'am' | 'or';

export interface Translations {
  title: string;
  subtitle: string;
  engineOnline: string;
  engineOffline: string;
  engineConnecting: string;
  // Metrics
  basinMeanRisk: string;
  spread: string;
  min: string;
  max: string;
  forecastTarget: string;
  leadAdvance: string;
  basinName: string;
  chokeMountain: string;
  elevation: string;
  aiFramework: string;
  superHybrid: string;
  aiComponents: string;
  // Grid
  gridTitle: string;
  gridSubtitle: string;
  leadLabel: string;
  lead1: string;
  lead2: string;
  lead3: string;
  targetHorizon: string;
  issued: string;
  meanBasinRisk: string;
  computingInference: string;
  selectedCell: string;
  riskProbability: string;
  legend: string;
  lowRisk: string;
  moderateRisk: string;
  highRisk: string;
  severeRisk: string;
  bbox: string;
  // Advisory
  advisoryTitle: string;
  advisorySubtitle: string;
  targetCrop: string;
  tefLabel: string;
  tefDesc: string;
  wheatLabel: string;
  wheatDesc: string;
  maizeLabel: string;
  maizeDesc: string;
  iekTitle: string;
  iekAgrees: string;
  iekDisagrees: string;
  iekNotSet: string;
  evalCrop: string;
  evalRisk: string;
  cropAdjustedRisk: string;
  rawGrid: string;
  strategyTitle: string;
  plantingTitle: string;
  waterTitle: string;
  prepTitle: string;
  iekIntegration: string;
  confidenceRating: string;
  // ENSO
  ensoTitle: string;
  ensoSubtitle: string;
  teleconnectionImpact: string;
  ensoOutlookTitle: string;
  threshold: string;
  monthPlus: string;
  // Footer
  footerAffiliation: string;
  footerTelemetry: string;
  footerFramework: string;
}

export const translations: Record<Language, Translations> = {
  en: {
    title: 'AgriMinds AI-DREWS',
    subtitle: 'Choke Mountain Watershed, Amhara, Ethiopia',
    engineOnline: 'FastAPI ML Engine Online',
    engineOffline: 'API Offline',
    engineConnecting: 'Connecting API...',
    basinMeanRisk: 'Basin Mean Drought Risk',
    spread: 'Spread',
    min: 'min',
    max: 'max',
    forecastTarget: 'Forecast Target',
    leadAdvance: 'advance warning',
    basinName: 'Agro-Ecological Basin',
    chokeMountain: 'Choke Mountain',
    elevation: 'Elevation: 2,800m - 4,070m a.s.l.',
    aiFramework: 'AI Framework',
    superHybrid: 'Super-Hybrid',
    aiComponents: 'CNN-2D + LSTM + Fourier Periodicity',
    gridTitle: 'Choke Watershed Drought Risk Grid',
    gridSubtitle: 'Objective 2: Super-Hybrid CNN-LSTM-Fourier SPI-3 probability (P ≤ -1.0)',
    leadLabel: 'Lead:',
    lead1: '1 Mo (Near)',
    lead2: '2 Mo (Mid)',
    lead3: '3 Mo (Seasonal)',
    targetHorizon: 'Target Horizon',
    issued: 'Issued',
    meanBasinRisk: 'Mean Basin Risk',
    computingInference: 'Computing spatial inference...',
    selectedCell: 'Selected Farm Cell',
    riskProbability: 'Risk Probability',
    legend: 'Legend',
    lowRisk: '<25% (Low)',
    moderateRisk: '25-45% (Moderate)',
    highRisk: '45-65% (High)',
    severeRisk: '>65% (Severe)',
    bbox: 'BBox: 37.6°E - 38.4°E, 10.4°N - 11.2°N',
    advisoryTitle: 'Agro-Decision Support & Farm Micro-Advisories',
    advisorySubtitle: 'Objective 3: Localized recommendations co-designed for Choke Watershed smallholders',
    targetCrop: 'Target Staple Crop',
    tefLabel: 'Tef (ጤፍ)',
    tefDesc: 'Short cycle',
    wheatLabel: 'Wheat (ስንዴ)',
    wheatDesc: 'Tillering sens.',
    maizeLabel: 'Maize (በቆሎ)',
    maizeDesc: 'High water need',
    iekTitle: 'Indigenous Knowledge (IEK)',
    iekAgrees: 'Agrees (Dry)',
    iekDisagrees: 'Disagrees',
    iekNotSet: 'Not Set',
    evalCrop: 'Evaluated Crop',
    evalRisk: 'Drought Risk',
    cropAdjustedRisk: 'Crop-Adjusted Risk',
    rawGrid: 'Raw Grid',
    strategyTitle: 'Crop Strategy',
    plantingTitle: 'Planting Window',
    waterTitle: 'Water Management',
    prepTitle: 'Preparedness',
    iekIntegration: 'Indigenous Knowledge Integration',
    confidenceRating: 'Confidence Rating',
    ensoTitle: 'ENSO Climate Engine (Niño 3.4)',
    ensoSubtitle: 'Objective 1: CNN-LSTM teleconnection forecast driving regional hydro-climatic risks',
    teleconnectionImpact: 'Teleconnection Impact',
    ensoOutlookTitle: 'CNN-LSTM Niño 3.4 Multi-Lead Outlook (6 Months)',
    threshold: 'Threshold: ±0.5°C',
    monthPlus: 'Month +',
    footerAffiliation: 'AgriMinds AI-DREWS — Debre Markos University & AI Institute of Ethiopia.',
    footerTelemetry: 'CHIRPS · ERA5 · NOAA ONI Telemetry',
    footerFramework: 'PyTorch Super-Hybrid Deep Learning',
  },
  am: {
    title: 'አግሪማይንድስ AI-DREWS',
    subtitle: 'የጮቄ ተራራ ተፋሰስ፣ አማራ ክልል፣ ኢትዮጵያ',
    engineOnline: 'FastAPI AI ሞተር በመስመር ላይ',
    engineOffline: 'API ከመስመር ውጭ',
    engineConnecting: 'በመገናኘት ላይ...',
    basinMeanRisk: 'የተፋሰሱ አማካይ ድርቅ አደጋ',
    spread: 'ልዩነት',
    min: 'ዝቅተኛ',
    max: 'ከፍተኛ',
    forecastTarget: 'የትንበያ ኢላማ',
    leadAdvance: 'ቅድመ ማስጠንቀቂያ',
    basinName: 'ግብርና-ሥነ-ምህዳር ተፋሰስ',
    chokeMountain: 'የጮቄ ተራራ',
    elevation: 'ከፍታ፡ 2,800 - 4,070 ሜትር',
    aiFramework: 'የአርቴፊሻል ኢንተለጀንስ ሞዴል',
    superHybrid: 'ሱፐር-ሀይብሪድ (Super-Hybrid)',
    aiComponents: 'CNN-2D + LSTM + ፉሪየር ሞገድ',
    gridTitle: 'የጮቄ ተፋሰስ የድርቅ አደጋ ካርታ',
    gridSubtitle: 'ግብ 2፡ ሱፐር-ሀይብሪድ CNN-LSTM-Fourier SPI-3 ድርቅ እድል (P ≤ -1.0)',
    leadLabel: 'የጊዜ ርዝመት፡',
    lead1: '1 ወር (ቅርብ)',
    lead2: '2 ወር (መካከለኛ)',
    lead3: '3 ወር (ወቅታዊ)',
    targetHorizon: 'የትንበያ ጊዜ',
    issued: 'የወጣበት ቀን',
    meanBasinRisk: 'የተፋሰሱ አማካይ አደጋ',
    computingInference: 'ትንበያ በማስላት ላይ...',
    selectedCell: 'የተመረጠ እርሻ ቦታ',
    riskProbability: 'የአደጋ እድል',
    legend: 'መመሪያ',
    lowRisk: '<25% (ዝቅተኛ)',
    moderateRisk: '25-45% (መካከለኛ)',
    highRisk: '45-65% (ከፍተኛ)',
    severeRisk: '>65% (አስጊ)',
    bbox: 'ወሰን፡ 37.6°E - 38.4°E, 10.4°N - 11.2°N',
    advisoryTitle: 'የግብርና ውሳኔ ድጋፍ እና ማይክሮ-ምክረ ሃሳቦች',
    advisorySubtitle: 'ግብ 3፡ ለጮቄ ተፋሰስ አርሶ አደሮች የተዘጋጁ ተግባራዊ ምክረ ሃሳቦች',
    targetCrop: 'ዋነኛ ሰብል ይምረጡ',
    tefLabel: 'ጤፍ (Tef)',
    tefDesc: 'አጭር የእድገት ጊዜ',
    wheatLabel: 'ስንዴ (Wheat)',
    wheatDesc: 'እርጥበት ሚስጥራዊ',
    maizeLabel: 'በቆሎ (Maize)',
    maizeDesc: 'ከፍተኛ ውሃ ፈላጊ',
    iekTitle: 'የአካባቢ ባህላዊ እውቀት (IEK)',
    iekAgrees: 'ይስማማል (ድርቅ)',
    iekDisagrees: 'አይስማማም',
    iekNotSet: 'አልተመረጠም',
    evalCrop: 'የተመረጠ ሰብል',
    evalRisk: 'የድርቅ አደጋ ደረጃ',
    cropAdjustedRisk: 'ለሰብሉ የተስተካከለ አደጋ',
    rawGrid: 'ቀጥታ አደጋ',
    strategyTitle: 'የሰብል ስትራቴጂ',
    plantingTitle: 'የመዝሪያ ወቅት',
    waterTitle: 'የውሃና እርጥበት አያያዝ',
    prepTitle: 'ቅድመ ዝግጅት',
    iekIntegration: 'የባህላዊ እውቀት ውህደት',
    confidenceRating: 'የእርግጠኝነት ደረጃ',
    ensoTitle: 'የኤል ኒኞ የአየር ንብረት ሞተር (Niño 3.4)',
    ensoSubtitle: 'ግብ 1፡ CNN-LSTM ዓለም አቀፍ የአየር ንብረት ትንበያ',
    teleconnectionImpact: 'የአየር ንብረት ተፅእኖ',
    ensoOutlookTitle: 'CNN-LSTM የኒኞ 3.4 የ 6 ወራት እይታ',
    threshold: 'ገደብ፡ ±0.5°C',
    monthPlus: 'ወር +',
    footerAffiliation: 'አግሪማይንድስ AI-DREWS — ደብረ ማርቆስ ዩኒቨርሲቲ እና የኢትዮጵያ አርቴፊሻል ኢንተለጀንስ ኢንስቲትዩት',
    footerTelemetry: 'CHIRPS · ERA5 · NOAA ONI ሳተላይት መረጃ',
    footerFramework: 'ፓይቶርች (PyTorch) ሱፐር-ሀይብሪድ ጥልቅ ትምህርት',
  },
  or: {
    title: 'AgriMinds AI-DREWS',
    subtitle: 'Lolaa Gaara Choke, Naannoo Amaaraa, Itoophiyaa',
    engineOnline: 'FastAPI AI Toora Irra Jira',
    engineOffline: 'API Toora Irraa Baheera',
    engineConnecting: 'Walqunnamsiisaa jira...',
    basinMeanRisk: 'Giddu-galeessa Sodaa Hongee',
    spread: 'Garaagarummaa',
    min: 'Gadi-aanaa',
    max: 'Olaanaa',
    forecastTarget: 'Galma Raagichaa',
    leadAdvance: 'Akeekkachiisa duraa',
    basinName: 'Sulula Qonna-Ikoloojii',
    chokeMountain: 'Gaara Choke',
    elevation: 'Olka\'iinsa: 2,800m - 4,070m',
    aiFramework: 'Moodeela Saayinsii AI',
    superHybrid: 'Super-Hybrid',
    aiComponents: 'CNN-2D + LSTM + Fourier',
    gridTitle: 'Kaartaa Sodaa Hongee Choke',
    gridSubtitle: 'Galma 2: Moodeela Super-Hybrid SPI-3 carraa hongee (P ≤ -1.0)',
    leadLabel: 'Yeroo:',
    lead1: 'Ji\'a 1 (Dhihoo)',
    lead2: 'Ji\'a 2 (Giddugala)',
    lead3: 'Ji\'a 3 (Waqtii)',
    targetHorizon: 'Yeroo Raagichaa',
    issued: 'Kan Bahe',
    meanBasinRisk: 'Sodaa Giddu-galeessaa',
    computingInference: 'Herregaa jira...',
    selectedCell: 'Qotiisa Filatame',
    riskProbability: 'Carraa Sodaa',
    legend: 'Ibsa',
    lowRisk: '<25% (Gadi-aanaa)',
    moderateRisk: '25-45% (Giddugaleessa)',
    highRisk: '45-65% (Olaanaa)',
    severeRisk: '>65% (Balaa)',
    bbox: 'Daangaa: 37.6°E - 38.4°E, 10.4°N - 11.2°N',
    advisoryTitle: 'Deeggarsa Murtoo Qonnaa & Gorsa Oomishaa',
    advisorySubtitle: 'Galma 3: Gorsa qonnaan bultoota Gaara Choketiif qophaa\'e',
    targetCrop: 'Midhaan Filatame',
    tefLabel: 'Xaafii (Tef)',
    tefDesc: 'Marsaa gabaabaa',
    wheatLabel: 'Qamadii (Wheat)',
    wheatDesc: 'Jiidhina barbaada',
    maizeLabel: 'Boqqoolloo (Maize)',
    maizeDesc: 'Bishaan baay\'ee',
    iekTitle: 'Beekumsa Aadaa Naannoo (IEK)',
    iekAgrees: 'Waliigala (Hongee)',
    iekDisagrees: 'Waliihingalu',
    iekNotSet: 'Hinfiliamne',
    evalCrop: 'Midhaan Qoratame',
    evalRisk: 'Sodaa Hongee',
    cropAdjustedRisk: 'Sodaa Midhaaniif Sirreeffame',
    rawGrid: 'Sodaa Kaartaa',
    strategyTitle: 'Tarsiimoo Midhaanii',
    plantingTitle: 'Waqtii Facaasaa',
    waterTitle: 'Bulchiinsa Bishaan & Jiidhinaa',
    prepTitle: 'Qophii Duraa',
    iekIntegration: 'Waliigaltee Beekumsa Aadaa',
    confidenceRating: 'Sadarkaa Amanamummaa',
    ensoTitle: 'Moodeela Qilleensa ENSO (Niño 3.4)',
    ensoSubtitle: 'Galma 1: Raaga CNN-LSTM haala qilleensa idil-addunyaa',
    teleconnectionImpact: 'Dhiibbaa Qilleensaa',
    ensoOutlookTitle: 'Raaga Ji\'oota 6 Niño 3.4',
    threshold: 'Daangaa: ±0.5°C',
    monthPlus: 'Ji\'a +',
    footerAffiliation: 'AgriMinds AI-DREWS — Yuunivarsiitii Dabra Maarqoos & Dhaabbata AI Itoophiyaa',
    footerTelemetry: 'Oodeeffannoo Saateelaayitii CHIRPS · ERA5 · NOAA ONI',
    footerFramework: 'PyTorch Super-Hybrid Deep Learning',
  },
};
