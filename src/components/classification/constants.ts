import type { ClassificationOption } from "./types";

export const LSB_OPTIONS_LEGACY: ClassificationOption[] = [
  { value: -1, label: "Failed fitting [-]", color: "bg-red-500" },
  { value: 0, label: "Non-LSB [0]", color: "bg-gray-500" },
  { value: 1, label: "LSB [1]", color: "bg-green-500" },
];

export const LSB_OPTIONS_CHECKBOX: ClassificationOption[] = [
  { value: 0, label: "Non-LSB [0]", color: "bg-gray-500" },
  { value: 1, label: "LSB [1]", color: "bg-green-500" },
];

export const MORPHOLOGY_OPTIONS: ClassificationOption[] = [
  { value: -1, label: "Featureless [-]", color: "bg-gray-500" },
  { value: 0, label: "Not sure (Irr/other) [0]", color: "bg-yellow-500" },
  { value: 1, label: "LTG (Sp) [1]", color: "bg-blue-500" },
  { value: 2, label: "ETG (Ell) [2]", color: "bg-purple-500" },
];

export const ALLOWED_QUICK_INPUT_CHARS_LEGACY = /^[-012arn]*$/;
export const ALLOWED_QUICK_INPUT_CHARS_CHECKBOX = /^[-012arnf]*$/;

