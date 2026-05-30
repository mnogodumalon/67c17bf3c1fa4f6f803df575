// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Ausgabenuebersicht {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    ausgaben_kategorie?: LookupValue;
    ausgaben_betrag?: number;
    ausgaben_beschreibung?: string;
    neues_feld?: string; // applookup -> URL zu 'UnknownApp' Record
    datum?: string; // Format: YYYY-MM-DD oder ISO String
  };
}

export interface Einnahmenuebersicht {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    einnahmen_betrag?: number;
    datum?: string; // Format: YYYY-MM-DD oder ISO String
    einnahmen_kategorie?: LookupValue;
    einnahmen_beschreibung?: string;
  };
}

export const APP_IDS = {
  AUSGABENUEBERSICHT: '67c17bf34fb0c01e5f48c85b',
  EINNAHMENUEBERSICHT: '67c17bea1aa71139a082efdb',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'ausgabenuebersicht': {
    ausgaben_kategorie: [{ key: "auto", label: "Auto" }, { key: "miete", label: "Miete" }, { key: "lebensmittel", label: "Lebensmittel" }],
  },
  'einnahmenuebersicht': {
    einnahmen_kategorie: [{ key: "gehalt", label: "Gehalt" }, { key: "bonus", label: "Bonus" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'ausgabenuebersicht': {
    'ausgaben_kategorie': 'lookup/select',
    'ausgaben_betrag': 'number',
    'ausgaben_beschreibung': 'string/text',
    'neues_feld': 'applookup/select',
    'datum': 'date/date',
  },
  'einnahmenuebersicht': {
    'einnahmen_betrag': 'number',
    'datum': 'date/date',
    'einnahmen_kategorie': 'lookup/select',
    'einnahmen_beschreibung': 'string/text',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateAusgabenuebersicht = StripLookup<Ausgabenuebersicht['fields']>;
export type CreateEinnahmenuebersicht = StripLookup<Einnahmenuebersicht['fields']>;