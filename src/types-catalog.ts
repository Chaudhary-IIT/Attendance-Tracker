/** A read-only entry in the bundled institute course list. */
export type CatalogCourse = {
  code: string;
  name: string;
  credits: number;
  faculty: string;
  /** Matches a seeded Slot.key, or 'NONE' when the chart lists no slot. */
  slotKey: string;
  room: string;
  campus: string;
};
