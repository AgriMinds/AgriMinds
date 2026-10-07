"""
Integration tests for AgriMinds AI-DREWS API endpoints.
Uses `requests` against the active service instance.
"""

import os
import requests
import unittest

BASE_URL = os.getenv("TEST_BASE_URL", "http://127.0.0.1:8000/api/v1")

class AgriMindsApiTests(unittest.TestCase):

    def test_01_health(self):
        res = requests.get(f"{BASE_URL}/health")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "healthy")
        self.assertTrue(data["artifacts_loaded"])
        self.assertTrue(data["models"]["enso_cnnlstm"])
        self.assertTrue(data["models"]["drought_superhybrid"])

    def test_02_drought_map(self):
        res = requests.get(f"{BASE_URL}/drought/map?lead_month=1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["lead_month"], 1)
        self.assertEqual(data["grid_shape"], [8, 8])
        self.assertEqual(len(data["probabilities"]), 8)
        self.assertEqual(len(data["probabilities"][0]), 8)
        self.assertGreaterEqual(data["mean_probability"], 0.0)
        self.assertLessEqual(data["mean_probability"], 1.0)

    def test_03_drought_cell_get(self):
        res = requests.get(f"{BASE_URL}/drought/cell?row=3&col=4&lead_month=1")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["row"], 3)
        self.assertEqual(data["col"], 4)
        self.assertIn(data["risk_level"], ["Low", "Moderate", "High", "Severe"])

    def test_04_drought_cell_post(self):
        payload = {"lead_month": 2, "row": 2, "col": 5}
        res = requests.post(f"{BASE_URL}/drought/cell", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["row"], 2)
        self.assertEqual(data["col"], 5)
        self.assertGreaterEqual(data["probability"], 0.0)

    def test_05_advisories_evaluate(self):
        crops = ["tef", "wheat", "maize"]
        for crop in crops:
            payload = {
                "crop": crop,
                "lead_month": 1,
                "row": 4,
                "col": 4,
                "iek_agrees": True
            }
            res = requests.post(f"{BASE_URL}/advisories/evaluate", json=payload)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertEqual(data["crop"], crop)
            self.assertIn("crop_recommendation", data)
            self.assertIn("planting_window", data)
            self.assertIn("water_management", data)
            self.assertIn("confidence_level", data)

    def test_06_enso_outlook(self):
        res = requests.get(f"{BASE_URL}/enso/outlook")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("current_nino34", data)
        self.assertIn(data["current_state"], ["El Niño", "La Niña", "Neutral"])
        self.assertGreaterEqual(len(data["forecast_series"]), 3)

if __name__ == "__main__":
    unittest.main()
