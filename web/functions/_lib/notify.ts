import type { LeadRecord } from '../../../packages/lead-schema/src/index.ts';
import type { FetchFn, LeadEnv } from './env.ts';

/** The R2 object key of a lead. One place, so the notification and the write can never disagree. */
export function leadKey(r: Pick<LeadRecord, 'kind' | 'id' | 'created'>): string {
  return `leads/${r.created.slice(0, 10)}/${r.kind}-${r.id}.json`;
}

/**
 * THE NOTIFIER LIVES IN THIS FILE, BEHIND ONE FUNCTION. To use another channel (email, Teams, ...), replace
 * the body of `sendLeadNotification`; the handler only calls it.
 *
 * Contract: BEST EFFORT. The lead is already safe in R2 when this runs. With no SLACK_WEBHOOK_URL it logs and
 * returns normally. On a Slack error it throws, and the handler catches that, logs it and still reports success.
 * Never make a notification failure fail a submission.
 */
export async function sendLeadNotification(env: LeadEnv, record: LeadRecord, fetchFn: FetchFn): Promise<void> {
  const url = (env.SLACK_WEBHOOK_URL ?? '').trim();
  if (!url) {
    console.log(JSON.stringify({ event: 'lead_notify_skipped', reason: 'no_webhook', id: record.id, kind: record.kind }));
    return;
  }
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: formatSlackMessage(record) }),
  });
  if (!res.ok) throw new Error(`slack_http_${res.status}`);
}

// Staff-facing text (it goes to the sales team's channel, not to a visitor), so it is not in the visitor string lookup.
const KIND_LABEL: Record<LeadRecord['kind'], string> = {
  contact: 'Liên hệ B2B',
  consult: 'Tư vấn sản phẩm',
  service: 'Yêu cầu dịch vụ',
  showroom_booking: 'Đặt lịch showroom',
  partnership: 'Đề xuất hợp tác',
  warranty: 'Bảo hành / sửa chữa',
  ai_assist: 'Tư vấn cùng AI',
};

/**
 * DELIBERATELY MINIMAL. A Slack channel is a third party with its own history and its own notifications for
 * everyone in it; a prospect's phone and email do not belong there. The message says what came in, when, from
 * whom in the loosest sense (company, else the given name, which in Vietnamese is the last word), and where the
 * full record is. It never carries phone, email, message text or surname. The full record is in R2 either way.
 */
export function formatSlackMessage(r: LeadRecord): string {
  const who = (r.company ?? r.name.trim().split(/\s+/).pop() ?? '').replace(/\s+/g, ' ').slice(0, 60);
  return [`Yêu cầu mới: ${KIND_LABEL[r.kind]}${who ? ` (${who})` : ''}`, `Lúc: ${r.created}`, `Mã: ${r.id.slice(0, 8)}`, `Bản đầy đủ trong R2: ${leadKey(r)}`].join('\n');
}
