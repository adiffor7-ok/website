#!/usr/bin/env python3
"""Shared color conversion and classification helpers."""

from __future__ import annotations

import math
from typing import Dict, Tuple

# Reference white for D65 illuminant (CIE 1931 2°)
REF_X = 95.047
REF_Y = 100.0
REF_Z = 108.883

# Thresholds (tuneable)
BLACK_LIGHTNESS_MAX = 20
BLACK_CHROMA_MAX = 22
WHITE_LIGHTNESS_MIN = 87
WHITE_CHROMA_MAX = 14
GREY_CHROMA_MAX = 14


def _srgb_channel_to_linear(channel: float) -> float:
  value = channel / 255.0
  if value <= 0.04045:
    return value / 12.92
  return ((value + 0.055) / 1.055) ** 2.4


def _linear_channel_to_srgb(channel: float) -> float:
  if channel <= 0.0031308:
    return channel * 12.92
  return 1.055 * (channel ** (1 / 2.4)) - 0.055


def rgb_to_xyz(r: int, g: int, b: int) -> Tuple[float, float, float]:
  lr = _srgb_channel_to_linear(r)
  lg = _srgb_channel_to_linear(g)
  lb = _srgb_channel_to_linear(b)
  x = lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375
  y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.0721750
  z = lr * 0.0193339 + lg * 0.1191920 + lb * 0.9503041
  return x * 100.0, y * 100.0, z * 100.0


def xyz_to_rgb(x: float, y: float, z: float) -> Tuple[int, int, int]:
  x /= 100.0
  y /= 100.0
  z /= 100.0
  lr = x * 3.2404542 + y * -1.5371385 + z * -0.4985314
  lg = x * -0.9692660 + y * 1.8760108 + z * 0.0415560
  lb = x * 0.0556434 + y * -0.2040259 + z * 1.0572252
  r = max(0.0, min(1.0, _linear_channel_to_srgb(lr)))
  g = max(0.0, min(1.0, _linear_channel_to_srgb(lg)))
  b = max(0.0, min(1.0, _linear_channel_to_srgb(lb)))
  return int(round(r * 255)), int(round(g * 255)), int(round(b * 255))


def _pivot_xyz(value: float) -> float:
  epsilon = 216 / 24389
  kappa = 24389 / 27
  if value > epsilon:
    return value ** (1 / 3)
  return (kappa * value + 16) / 116


def _pivot_lab(value: float) -> float:
  if value ** 3 > 216 / 24389:
    return value ** 3
  return (116 * value - 16) / (24389 / 27)


def rgb_to_lab(r: int, g: int, b: int) -> Tuple[float, float, float]:
  x, y, z = rgb_to_xyz(r, g, b)
  xr = _pivot_xyz(x / REF_X)
  yr = _pivot_xyz(y / REF_Y)
  zr = _pivot_xyz(z / REF_Z)
  l = 116 * yr - 16
  a = 500 * (xr - yr)
  b_val = 200 * (yr - zr)
  return l, a, b_val


def lab_to_rgb(l: float, a: float, b_val: float) -> Tuple[int, int, int]:
  fy = (l + 16) / 116
  fx = fy + (a / 500)
  fz = fy - (b_val / 200)
  xr = _pivot_lab(fx)
  yr = _pivot_lab(fy)
  zr = _pivot_lab(fz)
  x = xr * REF_X
  y = yr * REF_Y
  z = zr * REF_Z
  return xyz_to_rgb(x, y, z)


def lab_to_lch(l: float, a: float, b_val: float) -> Tuple[float, float, float]:
  c = math.sqrt(a * a + b_val * b_val)
  hue_rad = math.atan2(b_val, a)
  hue_deg = math.degrees(hue_rad)
  if hue_deg < 0:
    hue_deg += 360
  return l, c, hue_deg


def compute_color_metrics(lab: Tuple[float, float, float]) -> Dict[str, float]:
  l, a, b_val = lab
  _, chroma, hue = lab_to_lch(l, a, b_val)
  if chroma < 1e-6:
    hue = float("nan")
  return {
    "lightness": float(l),
    "chroma": float(chroma),
    "hue": float(hue),
  }


def classify_color_lab(l: float, a: float, b_val: float) -> str:
  metrics = compute_color_metrics((l, a, b_val))
  lightness = metrics["lightness"]
  chroma = metrics["chroma"]
  hue = metrics["hue"]
  if lightness <= BLACK_LIGHTNESS_MAX and chroma <= BLACK_CHROMA_MAX:
    return "blacks"
  if lightness >= WHITE_LIGHTNESS_MIN and chroma <= WHITE_CHROMA_MAX:
    return "whites"
  if chroma <= GREY_CHROMA_MAX:
    return "greys"
  if math.isnan(hue):
    return "greys"
  if hue < 15 or hue >= 345:
    return "reds"
  if hue < 45:
    return "oranges"
  if hue < 75:
    return "yellows"
  if hue < 165:
    return "greens"
  if hue < 210:
    return "blues"
  if hue < 250:
    return "indigos"
  if hue < 300:
    return "purples"
  if hue < 345:
    return "pinks"
  return "reds"


def rgb_to_metrics(r: int, g: int, b: int) -> Dict[str, float]:
  lab = rgb_to_lab(r, g, b)
  return compute_color_metrics(lab)
