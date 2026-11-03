// Shared contracts between frontend and backend.

/** Make → Model → Badges, matching the shape of vehicleData.json. */
export type VehicleCatalog = Record<string, Record<string, string[]>>;

/** A fully specified vehicle. */
export interface VehicleSelection {
  make: string;
  model: string;
  badge: string;
}

/**
 * A validated submission, as rendered on the /upload page. Over the wire, POST /upload is
 * multipart/form-data: make, model and badge as text fields plus the logbook file (LOGBOOK_FIELD).
 */
export interface VehicleSubmission extends VehicleSelection {
  /** The uploaded logbook file's contents, decoded as UTF-8. */
  logbookText: string;
}
