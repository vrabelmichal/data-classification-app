import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "./_generated/api";
import { DataModel } from "./_generated/dataModel";

// Aggregate for galaxies sorted by ID (string)
export const galaxiesById = new TableAggregate<{
  Key: string;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesById, {
  sortKey: (doc) => doc.id,
});

// Aggregate for galaxies sorted by RA (number)
export const galaxiesByRa = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByRa, {
  sortKey: (doc) => doc.ra,
});

// Aggregate for galaxies sorted by Dec (number)
export const galaxiesByDec = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByDec, {
  sortKey: (doc) => doc.dec,
});

// Aggregate for galaxies sorted by effective radius (number)
export const galaxiesByReff = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByReff, {
  sortKey: (doc) => doc.reff,
});

// Aggregate for galaxies sorted by axis ratio (number)
export const galaxiesByQ = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByQ, {
  sortKey: (doc) => doc.q,
});

// Aggregate for galaxies sorted by position angle (number)
export const galaxiesByPa = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByPa, {
  sortKey: (doc) => doc.pa,
});

// Aggregate for galaxies sorted by nucleus (boolean)
export const galaxiesByNucleus = new TableAggregate<{
  Key: boolean;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByNucleus, {
  sortKey: (doc) => doc.nucleus,
});

// Aggregate for galaxies sorted by creation time (number)
export const galaxiesByCreationTime = new TableAggregate<{
  Key: number;
  DataModel: DataModel;
  TableName: "galaxies";
}>(components.galaxiesByCreationTime, {
  sortKey: (doc) => doc._creationTime,
});

// Helper function to get the appropriate aggregate based on sort field
export function getGalaxiesAggregate(sortBy: string) {
  switch (sortBy) {
    case "id":
      return galaxiesById;
    case "ra":
      return galaxiesByRa;
    case "dec":
      return galaxiesByDec;
    case "reff":
      return galaxiesByReff;
    case "q":
      return galaxiesByQ;
    case "pa":
      return galaxiesByPa;
    case "nucleus":
      return galaxiesByNucleus;
    case "_creationTime":
      return galaxiesByCreationTime;
    default:
      return galaxiesById; // fallback
  }
}