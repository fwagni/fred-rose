export type Role = 'pending' | 'admin' | 'inviter' | 'security';
export type Lang = 'fr' | 'en';
export type TemplateId = 'marine' | 'jardin' | 'ivoire' | 'nuit';
export type RsvpStatus = 'yes' | 'no' | 'remote';
export type Civility = 'm' | 'mme' | 'mlle' | 'dr';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  role: Role;
  quota: number;
  created_at?: string;
}

export interface EventItem {
  id: string;
  title_fr: string;
  title_en: string | null;
  starts_at: string;
  ends_at: string | null;
  venue_name: string | null;
  address: string | null;
  map_url: string | null;
  /** Lien de visioconférence (Zoom, Meet, YouTube Live…) ; vide = pas de suivi en ligne. */
  stream_url: string | null;
  notes_fr: string | null;
  notes_en: string | null;
  sort_order: number;
}

export interface Rsvp {
  guest_id?: string;
  event_id: string;
  status: RsvpStatus;
}

export interface Guest {
  id: string;
  invitation_id?: string;
  full_name: string;
  civility?: Civility | null;
  is_child: boolean;
  table_label: string | null;
  checked_in_at: string | null;
  rsvps?: Rsvp[];
}

export interface Invitation {
  id: string;
  token: string;
  /** Nom affiché facultatif (« Famille Ngo ») ; vide = les noms des personnes. */
  household_name: string | null;
  language: Lang;
  template: TemplateId;
  phone: string | null;
  email: string | null;
  message: string | null;
  inviter_id: string | null;
  opened_at: string | null;
  thanked_at: string | null;
  created_at: string;
  guests?: Guest[];
  invitation_events?: { event_id: string }[];
}

export interface Theme {
  navy: string;
  marine: string;
  gold: string;
  sand: string;
  ivory: string;
}

export interface Settings {
  couple_names: string;
  wedding_date: string | null;
  rsvp_deadline: string | null;
  theme: Theme | null;
  welcome_fr: string | null;
  welcome_en: string | null;
  thanks_fr: string | null;
  thanks_en: string | null;
  contact_phone: string | null;
}

export interface PublicInvitation {
  invitation: { id: string; household_name: string | null; language: Lang; template: TemplateId; message: string | null };
  guests: Guest[];
  events: EventItem[];
  settings: Settings;
}
