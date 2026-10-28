export type LeadStage = 'New' | 'Contacted' | 'Quoted' | 'Negotiation' | 'Converted' | 'Lost';

export interface Lead {
  id: string;
  [key: string]: unknown;
}

export const INITIAL_LEADS: Lead[] = [];
