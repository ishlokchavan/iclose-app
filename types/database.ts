export type UserRole = 'learner' | 'educator' | 'manager' | 'admin';

export type TopicStatus = 'draft' | 'published' | 'archived';

export type InquiryStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  role: UserRole;
  plan_key: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string;
  plan_key: string;
  source: string | null;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
}

export type HireKind = 'intern' | 'specialist';

export interface HireApplication {
  id: string;
  kind: HireKind;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  message: string | null;
  status: string;
  created_at: string;
  // intern-only
  instagram?: string | null;
  resume_path?: string | null;
}

export interface Area {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: string;
}

export interface PropertyType {
  id: string;
  name: string;
  slug: string;
  area_id: string | null;
  description: string | null;
  created_at: string;
}

export interface Subtype {
  id: string;
  name: string;
  slug: string;
  type_id: string;
  description: string | null;
  created_at: string;
}

export interface Educator {
  id: string;
  profile_id: string;
  bio: string | null;
  specializations: string[] | null;
  created_at: string;
  profile?: Profile;
}

export interface Topic {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  youtube_id: string | null;
  cover_image_url: string | null;
  status: TopicStatus;
  area_id: string | null;
  type_id: string | null;
  educator_id: string | null;
  resources: Resource[] | null;
  created_at: string;
  updated_at: string;
  area?: Area;
  property_type?: PropertyType;
  educator?: Educator & { profile: Profile };
}

export interface Resource {
  title: string;
  url: string;
  type: 'pdf' | 'link' | 'video';
}

export interface SavedTopic {
  id: string;
  user_id: string;
  topic_id: string;
  created_at: string;
  topic?: Topic;
}

export interface Inquiry {
  id: string;
  user_id: string;
  topic_id: string | null;
  title: string;
  description: string;
  area_id: string | null;
  type_id: string | null;
  status: InquiryStatus;
  response: string | null;
  responded_by: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  user?: Profile;
  topic?: Topic;
  area?: Area;
  property_type?: PropertyType;
}

export interface DashboardStats {
  totalTopics: number;
  publishedTopics: number;
  draftTopics: number;
  archivedTopics: number;
  totalInquiries: number;
  openInquiries: number;
  inProgressInquiries: number;
  resolvedInquiries: number;
}
