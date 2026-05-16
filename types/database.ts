export type UserRole = 'learner' | 'educator' | 'manager' | 'admin';

export type TopicStatus = 'draft' | 'published' | 'archived';

export type InquiryStatus = 'open' | 'assigned' | 'in_progress' | 'closed';

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
  referer?: string | null;
  // intern-only
  instagram?: string | null;
  resume_path?: string | null;
}

export interface HireRemark {
  id: string;
  application_id: string;
  content: string;
  created_by: string;
  created_by_name: string | null;
  created_at: string;
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
  name: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  bio: string | null;
  expertise: string | null;
  photo_url: string | null;
  status: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
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
  educator?: Educator;
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
  learner_id: string | null;
  description: string;
  email: string | null;
  phone: string | null;
  area_id: string | null;
  subarea: string | null;
  type_id: string | null;
  source_topic_id: string | null;
  assigned_educator_id: string | null;
  status: InquiryStatus;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  learner?: Profile;
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
