import type { CsvColumn } from "./csv";
import { formatDateForFilename, sanitizeFilenameSegment } from "./csv";

export const CLASSIFICATION_EXPORT_BATCH_SIZE = 500;

export type ClassificationExportRow = {
  _id: string;
  _creationTime: number;
  userId: string;
  galaxyExternalId: string;
  lsb_class: number;
  morphology: number;
  awesome_flag: boolean;
  valid_redshift: boolean;
  visible_nucleus?: boolean;
  failed_fitting?: boolean;
  comments?: string;
  sky_bkg?: number;
  timeSpent: number;
};

export type EnrichedClassificationExportRow = ClassificationExportRow & {
  userName: string | null;
  userEmail: string | null;
};

export type ClassificationExportColumnKey =
  | "_id"
  | "_creationTime"
  | "userId"
  | "userName"
  | "userEmail"
  | "galaxyExternalId"
  | "lsb_class"
  | "morphology"
  | "awesome_flag"
  | "valid_redshift"
  | "visible_nucleus"
  | "failed_fitting"
  | "comments"
  | "sky_bkg"
  | "timeSpent";

export type ClassificationExportColumnSelection = Record<ClassificationExportColumnKey, boolean>;

type ClassificationExportColumnDefinition = {
  key: ClassificationExportColumnKey;
  label: string;
  defaultSelected: boolean;
  group: "identity" | "classification";
  column: CsvColumn<EnrichedClassificationExportRow>;
};

export const classificationExportColumnDefinitions: ClassificationExportColumnDefinition[] = [
  {
    key: "userId",
    label: "User ID",
    defaultSelected: true,
    group: "identity",
    column: { header: "userId", getValue: (row) => row.userId },
  },
  {
    key: "userName",
    label: "User name",
    defaultSelected: false,
    group: "identity",
    column: { header: "userName", getValue: (row) => row.userName },
  },
  {
    key: "userEmail",
    label: "User email",
    defaultSelected: false,
    group: "identity",
    column: { header: "userEmail", getValue: (row) => row.userEmail },
  },
  {
    key: "_id",
    label: "Classification ID",
    defaultSelected: true,
    group: "classification",
    column: { header: "_id", getValue: (row) => row._id },
  },
  {
    key: "_creationTime",
    label: "Creation time",
    defaultSelected: true,
    group: "classification",
    column: { header: "_creationTime", getValue: (row) => row._creationTime },
  },
  {
    key: "galaxyExternalId",
    label: "Galaxy external ID",
    defaultSelected: true,
    group: "classification",
    column: { header: "galaxyExternalId", getValue: (row) => row.galaxyExternalId },
  },
  {
    key: "lsb_class",
    label: "LSB class",
    defaultSelected: true,
    group: "classification",
    column: { header: "lsb_class", getValue: (row) => row.lsb_class },
  },
  {
    key: "morphology",
    label: "Morphology",
    defaultSelected: true,
    group: "classification",
    column: { header: "morphology", getValue: (row) => row.morphology },
  },
  {
    key: "awesome_flag",
    label: "Awesome flag",
    defaultSelected: true,
    group: "classification",
    column: { header: "awesome_flag", getValue: (row) => row.awesome_flag },
  },
  {
    key: "valid_redshift",
    label: "Valid redshift",
    defaultSelected: true,
    group: "classification",
    column: { header: "valid_redshift", getValue: (row) => row.valid_redshift },
  },
  {
    key: "visible_nucleus",
    label: "Visible nucleus",
    defaultSelected: true,
    group: "classification",
    column: { header: "visible_nucleus", getValue: (row) => row.visible_nucleus },
  },
  {
    key: "failed_fitting",
    label: "Failed fitting",
    defaultSelected: true,
    group: "classification",
    column: { header: "failed_fitting", getValue: (row) => row.failed_fitting },
  },
  {
    key: "comments",
    label: "Comments",
    defaultSelected: true,
    group: "classification",
    column: { header: "comments", getValue: (row) => row.comments },
  },
  {
    key: "sky_bkg",
    label: "Sky background",
    defaultSelected: true,
    group: "classification",
    column: { header: "sky_bkg", getValue: (row) => row.sky_bkg },
  },
  {
    key: "timeSpent",
    label: "Time spent",
    defaultSelected: true,
    group: "classification",
    column: { header: "timeSpent", getValue: (row) => row.timeSpent },
  },
];

export const classificationExportColumnGroups = [
  {
    key: "identity" as const,
    label: "User fields",
    description: "Choose how users are identified in the CSV.",
  },
  {
    key: "classification" as const,
    label: "Classification fields",
    description: "Control which classification attributes are included in the generated CSV.",
  },
];

const defaultClassificationExportColumnSelection = classificationExportColumnDefinitions.reduce(
  (selection, definition) => {
    selection[definition.key] = definition.defaultSelected;
    return selection;
  },
  {} as ClassificationExportColumnSelection
);

export function getDefaultClassificationExportColumnSelection(): ClassificationExportColumnSelection {
  return { ...defaultClassificationExportColumnSelection };
}

export function sanitizeClassificationExportColumnSelection(
  value: Partial<ClassificationExportColumnSelection> | null | undefined
): ClassificationExportColumnSelection {
  const selection = getDefaultClassificationExportColumnSelection();

  if (!value) {
    return selection;
  }

  for (const definition of classificationExportColumnDefinitions) {
    if (typeof value[definition.key] === "boolean") {
      selection[definition.key] = value[definition.key] as boolean;
    }
  }

  return selection;
}

export function buildClassificationCsvColumns(
  selection: ClassificationExportColumnSelection
): CsvColumn<EnrichedClassificationExportRow>[] {
  return classificationExportColumnDefinitions
    .filter((definition) => selection[definition.key])
    .map((definition) => definition.column);
}

export function countSelectedClassificationExportColumns(selection: ClassificationExportColumnSelection) {
  return classificationExportColumnDefinitions.filter((definition) => selection[definition.key]).length;
}

export function buildAllClassificationsFileName() {
  return `classifications_all_users_${formatDateForFilename()}.csv`;
}

export function buildUserClassificationsFileName(userLabel: string) {
  return `classifications_${sanitizeFilenameSegment(userLabel)}_${formatDateForFilename()}.csv`;
}