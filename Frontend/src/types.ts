export type Category = {
  uuid: string;
  rolling_id: number;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  default_expanded: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Link = {
  uuid: string;
  rolling_id: number;
  title: string;
  url: string;
  description: string;
  icon: string | null;
  category_id: string | null;
  sort_order: number;
  click_count: number;
  open_in_new_tab: boolean;
  is_active: boolean;
  // Admin-only remark. Present on the admin link API; never returned by /api/directory.
  note?: string | null;
  created_at: string;
  updated_at: string;
};

// Shape returned by GET /api/directory: a category plus its active links.
export type DirectoryGroup = {
  uuid: string | null;
  name: string;
  description: string;
  icon: string | null;
  color: string | null;
  default_expanded: boolean;
  links: Link[];
};
