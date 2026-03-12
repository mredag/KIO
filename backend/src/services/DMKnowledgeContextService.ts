import Database from 'better-sqlite3';
import type { KnowledgeSelectionEntry } from './KnowledgeSelectionService.js';
import {
  buildDeterministicAppointmentTemplate,
  buildDeterministicCampaignTemplate,
  buildDeterministicHoursAppointmentTemplate,
  buildDeterministicHoursTemplate,
  buildDeterministicLocationTemplate,
  buildDeterministicMassagePricingTemplate,
  buildDeterministicPilatesTemplate,
  buildDeterministicPhoneTemplate,
  buildGenericInfoTemplate,
} from './GenericInfoTemplateService.js';

type KnowledgeContextMap = Record<string, Record<string, string>>;

interface KnowledgeSignatureRow {
  entryCount: number;
  maxUpdatedAt: string | null;
}

interface ActiveKnowledgeRow {
  category: string;
  key_name: string;
  value: string;
  description: string | null;
}

interface CachedValue<T> {
  signature: string;
  value: T;
}

export interface FilteredKnowledgeContext {
  signature: string;
  context: KnowledgeContextMap;
  json: string;
  entryCount: number;
}

export interface DeterministicKnowledgeTemplates {
  signature: string;
  genericInfo: string | null;
  massagePricingInfo: string | null;
  campaignInfo: string | null;
  pilatesInfo: string | null;
  contactLocation: string | null;
  contactPhone: string | null;
  generalHours: string | null;
  appointmentBooking: string | null;
  hoursWithAppointment: string | null;
}

export class DMKnowledgeContextService {
  private db: Database.Database;
  private baseContextCache: CachedValue<KnowledgeContextMap> | null = null;
  private supportEntriesCache: CachedValue<KnowledgeSelectionEntry[]> | null = null;
  private deterministicTemplateCache: CachedValue<DeterministicKnowledgeTemplates> | null = null;

  constructor(db: Database.Database) {
    this.db = db;
  }

  getActiveSignature(): string {
    const row = this.db.prepare(`
      SELECT COUNT(*) as entryCount, MAX(updated_at) as maxUpdatedAt
      FROM knowledge_base
      WHERE is_active = 1
    `).get() as KnowledgeSignatureRow;

    return `${row.entryCount || 0}:${row.maxUpdatedAt || 'none'}`;
  }

  getFilteredContext(categories?: Iterable<string>): FilteredKnowledgeContext {
    const signature = this.getActiveSignature();
    const baseContext = this.getBaseContext(signature);
    const requestedCategories = Array.from(new Set(
      Array.from(categories || [])
        .map(category => String(category || '').trim().toLowerCase())
        .filter(Boolean),
    ));

    const context = requestedCategories.length > 0
      ? this.filterContext(baseContext, requestedCategories)
      : baseContext;

    return {
      signature,
      context,
      json: JSON.stringify(context),
      entryCount: this.countEntries(context),
    };
  }

  getSupportEntries(): { signature: string; entries: KnowledgeSelectionEntry[] } {
    const signature = this.getActiveSignature();
    if (this.supportEntriesCache?.signature === signature) {
      return {
        signature,
        entries: this.supportEntriesCache.value,
      };
    }

    const rows = this.db.prepare(`
      SELECT category, key_name, value, description
      FROM knowledge_base
      WHERE is_active = 1 AND category IN ('faq', 'hours', 'policies')
      ORDER BY category, key_name
    `).all() as ActiveKnowledgeRow[];

    const entries = rows.map(row => ({
      category: row.category,
      key_name: row.key_name,
      value: row.value,
      description: row.description,
    }));

    this.supportEntriesCache = { signature, value: entries };
    return { signature, entries };
  }

  getDeterministicTemplates(): DeterministicKnowledgeTemplates {
    const signature = this.getActiveSignature();
    if (this.deterministicTemplateCache?.signature === signature) {
      return this.deterministicTemplateCache.value;
    }

    const context = this.getBaseContext(signature);
    const pricing = context.pricing || {};
    const services = context.services || {};
    const contact = context.contact || {};
    const hours = context.hours || {};
    const faq = context.faq || {};
    const policies = context.policies || {};
    const hourExtras = Object.entries(hours)
      .filter(([key]) => !['facility_working_hours', 'spa_working_hours'].includes(key))
      .map(([, value]) => value)
      .slice(0, 2);

    const templates: DeterministicKnowledgeTemplates = {
      signature,
      genericInfo: buildGenericInfoTemplate({
        massagePricing: pricing.complete_massage_pricing || this.pickFirstValue(pricing),
        therapistInfo: services.therapist_info || null,
        bringInfo: services.complete_customer_bring_guide || null,
        phoneInfo: contact.phone || null,
        locationInfo: contact.address || null,
      }),
      massagePricingInfo: buildDeterministicMassagePricingTemplate({
        massagePricing: pricing.complete_massage_pricing || this.pickFirstValue(pricing),
        phoneInfo: contact.phone || null,
      }),
      campaignInfo: buildDeterministicCampaignTemplate({
        campaignInfo: pricing.current_campaign || this.pickCampaignValue(pricing),
      }),
      pilatesInfo: buildDeterministicPilatesTemplate({
        pilatesDetails: services.reformer_pilates_details || null,
        pilatesPricing: pricing.reformer_pilates || null,
        locationInfo: contact.address || null,
        phoneInfo: contact.phone || null,
        whatsappInfo: contact.whatsapp || null,
      }),
      contactLocation: buildDeterministicLocationTemplate(contact.address || this.pickFirstValue(contact)),
      contactPhone: buildDeterministicPhoneTemplate(contact.phone || null),
      generalHours: buildDeterministicHoursTemplate({
        facilityHours: hours.facility_working_hours || null,
        spaHours: hours.spa_working_hours || null,
        extraHours: hourExtras,
      }),
      appointmentBooking: buildDeterministicAppointmentTemplate({
        appointmentInfo: faq.randevu_nasil || policies.complete_appointment_policy || null,
        phoneInfo: contact.phone || null,
        whatsappInfo: contact.whatsapp || null,
      }),
      hoursWithAppointment: buildDeterministicHoursAppointmentTemplate({
        hoursInfo: buildDeterministicHoursTemplate({
          facilityHours: hours.facility_working_hours || null,
          spaHours: hours.spa_working_hours || null,
          extraHours: hourExtras,
        }),
        appointmentInfo: buildDeterministicAppointmentTemplate({
          appointmentInfo: faq.randevu_nasil || policies.complete_appointment_policy || null,
          phoneInfo: contact.phone || null,
          whatsappInfo: contact.whatsapp || null,
        }),
      }),
    };

    this.deterministicTemplateCache = {
      signature,
      value: templates,
    };
    return templates;
  }

  private getBaseContext(signature: string): KnowledgeContextMap {
    if (this.baseContextCache?.signature === signature) {
      return this.baseContextCache.value;
    }

    const rows = this.db.prepare(`
      SELECT category, key_name, value, description
      FROM knowledge_base
      WHERE is_active = 1
      ORDER BY category, key_name
    `).all() as ActiveKnowledgeRow[];

    const context: KnowledgeContextMap = {};
    for (const row of rows) {
      if (!context[row.category]) {
        context[row.category] = {};
      }
      context[row.category][row.key_name] = row.value;
    }

    this.baseContextCache = { signature, value: context };
    return context;
  }

  private filterContext(context: KnowledgeContextMap, requestedCategories: string[]): KnowledgeContextMap {
    const filtered: KnowledgeContextMap = {};
    for (const category of requestedCategories) {
      if (context[category]) {
        filtered[category] = context[category];
      }
    }
    return filtered;
  }

  private countEntries(context: KnowledgeContextMap): number {
    return Object.values(context).reduce((sum, categoryEntries) => (
      sum + Object.keys(categoryEntries).length
    ), 0);
  }

  private pickFirstValue(entries: Record<string, string>): string | null {
    const [firstValue] = Object.values(entries);
    return firstValue || null;
  }

  private pickCampaignValue(entries: Record<string, string>): string | null {
    const match = Object.entries(entries).find(([key, value]) => (
      !!value?.trim() && /(campaign|kampanya|indirim|promo|promotion)/i.test(key)
    ));
    return match?.[1] || null;
  }
}
