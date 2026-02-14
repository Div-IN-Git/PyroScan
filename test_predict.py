#!/usr/bin/env python3
"""Basic tests for deterministic fake wildfire prediction models."""

from __future__ import annotations

import unittest
from pathlib import Path

import predict_server


class PredictModelTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.root = Path(__file__).resolve().parent
        cls.models_dir = cls.root / "models"
        if not cls.models_dir.exists() or not list(cls.models_dir.glob("*.pkl")):
            predict_server.generate_fake_models(cls.models_dir)
        cls.models = predict_server.load_models(cls.models_dir)

    def test_models_exist(self) -> None:
        self.assertIn("global_model", self.models)
        self.assertIn("continent_model", self.models)
        self.assertIn("local_model", self.models)

    def test_predictions_are_in_range(self) -> None:
        sample_tiles = ["4/4/4", "5/16/11", "6/31/20", "7/72/55"]
        for model in self.models.values():
            for day in [0, 3, 7, 9]:
                scores = model.predict_proba(sample_tiles, day)
                self.assertEqual(len(scores), len(sample_tiles))
                for score in scores:
                    self.assertGreaterEqual(score, 0.0)
                    self.assertLessEqual(score, 1.0)

    def test_predictions_are_deterministic(self) -> None:
        model = self.models["local_model"]
        tile = "6/42/27"
        day = 5
        first = model.predict(tile, day)
        second = model.predict(tile, day)
        self.assertEqual(first, second)

    def test_day_clamping_behavior(self) -> None:
        model = self.models["global_model"]
        tile = "5/18/10"
        low = model.predict(tile, -4)
        day0 = model.predict(tile, 0)
        high = model.predict(tile, 100)
        day9 = model.predict(tile, 9)
        self.assertEqual(low, day0)
        self.assertEqual(high, day9)

    def test_threshold_category_boundaries(self) -> None:
        checks = [
            (0.0, "safe"),
            (0.1999, "safe"),
            (0.2, "guarded"),
            (0.3999, "guarded"),
            (0.4, "elevated"),
            (0.5999, "elevated"),
            (0.6, "high"),
            (0.7999, "high"),
            (0.8, "extreme"),
            (1.0, "extreme"),
        ]
        for score, expected in checks:
            self.assertEqual(predict_server.category_from_confidence(score), expected)

    def test_invalid_tile_format_raises(self) -> None:
        with self.assertRaises(ValueError):
            predict_server.parse_tile_id("bad-tile")
        with self.assertRaises(ValueError):
            predict_server.parse_tile_id("3/9")


if __name__ == "__main__":
    unittest.main()

