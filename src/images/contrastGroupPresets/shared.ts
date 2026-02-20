import { ContrastGroup, ContrastGroupEntry, ContrastGroupWithDescription, ImageRectangle } from "../types";

export const rectangle256x256in1024x1024: ImageRectangle = {
  x: 384,
  y: 384,
  width: 256,
  height: 256,
};

const wideAplpyEntry: ContrastGroupEntry = {
  key: "aplpy_linear_p1_995_wide_unmasked",
  label: "APLpy Linear\n(p1_995 wide)",
  forcedQuality: "low",
  rectangle: rectangle256x256in1024x1024,
  allowEllipse: false,
};

export const fixedLastThreeByGroupIndex: ContrastGroup[] = [
  [
    { key: "aplpy_linear_based_on_109534177__1_995_unmasked_irg", label: "APLpy linear\n(109534177-based, irg)", showEllipse: true },
    { key: "aplpy_zscale_unmasked", label: "APLpy Zscale\n(unmasked)" },
    wideAplpyEntry,
  ],
  [
    { key: "aplpy_linear_based_on_109534177_unmasked", label: "APLpy Linear\n(109534177-based)", showEllipse: true },
    { key: "lupton__q_8__stretch_20", label: "Lupton\n(q=8, stretch=20, unmasked)" },
    wideAplpyEntry,
  ],
  [
    { key: "aplpy_linear_based_on_109534177_unmasked", label: "APLpy Linear\n(109534177-based)", showEllipse: true },
    { key: "aplpy_defaults_unmasked", label: "APLpy Defaults\n(unmasked)" },
    wideAplpyEntry,
  ],
  [
    { key: "aplpy_arcsinh_p001_100_vmid02_based_on_100426834_unmasked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.2, 100426834)", showEllipse: true },
    { key: "aplpy_arcsinh_p001_100_vmid01_masked", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.1, mask)" },
    wideAplpyEntry,
  ],
  [
    { key: "aplpy_linear_based_on_365515297_unmasked", label: "APLpy Linear\n(365515297-based)", showEllipse: true },
    { key: "aplpy_arcsinh_p001_100_vmid02_masked_irg", label: "APLpy Arcsinh\n(p0.01–100, vmid=0.2, mask, irg)" },
    wideAplpyEntry,
  ],
];

export function ensureSixItemContrastGroups(groups: ContrastGroup[]): ContrastGroup[] {
  return groups.map((group, index) => {
    if (group.length !== 6) {
      throw new Error(
        `[ImageDisplaySettings] Contrast group ${index} has ${group.length} items. Expected exactly 6 items.`,
      );
    }

    return group;
  });
}

export function buildContrastGroups(
  firstThreeByGroup: (ContrastGroup | ContrastGroupWithDescription)[]
): { groups: ContrastGroup[]; labels: string[]; descriptions: string[] } {
  const groups: ContrastGroup[] = [];
  const labels: string[] = [];
  const descriptions: string[] = [];

  firstThreeByGroup.forEach((groupOrObj, index) => {
    // Handle both array format (legacy) and object format (with label and description)
    const firstThree = Array.isArray(groupOrObj) ? groupOrObj : groupOrObj.entries;
    const label = Array.isArray(groupOrObj) ? undefined : groupOrObj.label;
    const description = Array.isArray(groupOrObj) ? undefined : groupOrObj.description;

    if (firstThree.length !== 3) {
      throw new Error(
        `[ImageDisplaySettings] Contrast group ${index} has ${firstThree.length} items in positions 1-3. Expected exactly 3 (band, residual, model).`,
      );
    }

    const fixedTail = fixedLastThreeByGroupIndex[index % fixedLastThreeByGroupIndex.length];
    if (fixedTail.length !== 3) {
      throw new Error(
        `[ImageDisplaySettings] Fixed tail group ${index % fixedLastThreeByGroupIndex.length} has ${fixedTail.length} items. Expected exactly 3.`,
      );
    }

    groups.push([...firstThree, ...fixedTail]);
    labels.push(label || "");
    descriptions.push(description || "");
  });

  return {
    groups: ensureSixItemContrastGroups(groups),
    labels,
    descriptions,
  };
}
