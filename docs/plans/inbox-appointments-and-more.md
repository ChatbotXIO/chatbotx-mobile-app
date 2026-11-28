# Plan: Inbox mobile — Appointment & tính năng bổ sung

> Trạng thái: **Chờ xác nhận** · Ngày: 2026-11-28 · Branch: `realcodesiman/appointment-and-more`

## 1. Mục tiêu

Đưa các tính năng của màn hình inbox web (aha.chat) sang inbox mobile, ưu tiên **Appointment**:

- Gửi link đặt lịch cho khách từ composer.
- Xem / tạo / huỷ lịch hẹn của contact trong contact panel.
- Hiển thị đúng tin nhắn dạng button template / carousel (link đặt lịch được gửi dưới dạng button template).
- Các tính năng nhanh còn thiếu: notes CRUD, resend tin lỗi, WhatsApp template.

## 2. Gap analysis (web vs mobile)

| Nhóm                                                                                     | Web                                                                      | Mobile hiện tại                                                           | Ưu tiên          |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------- | ---------------- |
| Appointment — composer                                                                   | Chọn calendar → gửi link / mở link đặt hộ                                | Chưa có                                                                   | **P1**           |
| Appointment — contact panel                                                              | List, tạo (calendar → timezone → slot), huỷ                              | Chưa có                                                                   | **P1**           |
| Render button template / carousel                                                        | Có                                                                       | Hiện "unsupported" (`src/features/chat/components/rich-content-view.tsx`) | **P1** (tiền đề) |
| Contact notes                                                                            | Thêm / sửa / xoá                                                         | Chỉ đọc (`src/features/contacts/notes-tab.tsx`)                           | P2               |
| Resend tin lỗi                                                                           | `POST /v1/conversations/{cid}/messages/{mid}/resend`                     | Chưa có (route thiếu trong schema)                                        | P2               |
| WhatsApp template khi window đóng                                                        | `POST /v1/conversations/{id}/whatsapp-template`                          | Chỉ có `window-closed-bar.tsx`                                            | P2               |
| Pipelines / deals                                                                        | `GET /v1/contacts/{identifier}/pipeline-items`, …                        | Chưa có                                                                   | P3               |
| Translation                                                                              | `/v1/conversations/{id}/translation*`, event `messageTranslationUpdated` | Bỏ qua event                                                              | P3               |
| Products, media library, thread control, ad referrals / coupons / broadcasts (read-only) | Có                                                                       | Chưa có                                                                   | P3               |

Mobile đã có: list/filters, assign, follow, archive, bot on/off, mark unread, send flow, saved replies, attachments, sequences, tags, custom fields, edit/delete message.

## 3. Thông tin API Appointment (`/v1`, scope `appointments`)

| Thao tác        | Route                                                                                                  | Ghi chú                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| List calendars  | `GET /v1/appointment-calendars?search&page&perPage`                                                    | Calendar inactive → disable trong picker                                                                 |
| Calendar detail | `GET /v1/appointment-calendars/{id}`                                                                   | Lấy `timezone`, `durationMinutes`, `locationType`                                                        |
| Slots           | `GET /v1/appointment-calendars/{id}/availability?startDate&endDate&contactId`                          | Tối đa 90 ngày; **không trả timezone** → lấy từ calendar detail                                          |
| Book            | `POST /v1/appointments` `{calendarId, contactId, conversationId?, inboxId?, startAt, inviteeTimezone}` | 201. `inboxId` cần `conversationId`. Không có conversation → khách không được thông báo                  |
| Booking link    | `POST /v1/conversations/{id}/appointment-booking-link` `{calendarId, inboxId?, send}`                  | → `{url, expiresAt (24h), calendar, messageId}`. `send=true` cần thêm scope `inbox`; pause bot 24h       |
| List            | `GET /v1/appointments?calendarId&tab=next\|past&search&page&perPage`                                   | Item có `calendarName`, `scheduleUrl`, `cancellable`, `deletable`. **Chưa filter được theo `contactId`** |
| Get             | `GET /v1/appointments/{id}`                                                                            |                                                                                                          |
| Cancel          | `POST /v1/appointments/{id}/cancel`                                                                    | Chạy cancellation flow, huỷ reminders                                                                    |
| Delete          | `DELETE /v1/appointments/{id}`                                                                         | Lịch upcoming phải cancel trước                                                                          |
| Reschedule      | —                                                                                                      | **Không tồn tại** (kể cả web): cancel + book lại                                                         |

Lỗi khi book cần xử lý: slot không còn trống, availability thay đổi (→ refetch slots), contact đã có lịch giờ đó (409).

Data model chính: `Appointment { id, calendarId, contactId, conversationId?, contactInboxId?, startAt, endAt, inviteeTimezone, status: scheduled|cancelled, cancelledAt, locationType: inPerson|phoneCall|onlineMeeting, locationDetail }`.

Không có realtime event cho appointment → invalidate query sau mỗi mutation.

## 4. Các phase

### Phase 0 — Chuẩn bị (~0.5 ngày)

- [ ] Regenerate `src/api/generated/schema.ts` (thiếu `appointment-booking-link`, `resend`, `translation*`). Chạy `tsc` kiểm tra code hiện có.
- [ ] Thêm `ws.appointments`, `ws.appointmentCalendars` vào `src/api/query-keys.ts`.
- [ ] Thêm cờ `FEATURES.appointments` vào `src/config/features.ts`.
- [ ] **Backend (repo aha.chat, cần xác nhận):** thêm filter `contactId` vào `GET /v1/appointments` (hoặc route `GET /v1/contacts/{identifier}/appointments`).

### Phase 1 — Renderer button template / carousel (~0.5–1 ngày)

- [ ] `src/features/chat/components/template-message-view.tsx`: text + nút `url` (mở bằng `expo-web-browser`), `phone` (`tel:`), `copy-code` (clipboard), `postback` (hiển thị, không bấm).
- [ ] Carousel: FlatList ngang, card gồm ảnh / title / subtitle / buttons.
- [ ] Route trong `message-bubble.tsx` theo `contentAttributes.type === "template"` + `templateType`.
- [ ] Test renderer cho từng loại nút.

### Phase 2 — Appointment trong composer (~1 ngày)

- [ ] `src/features/appointments/api/use-appointment-calendars.ts`
- [ ] `src/features/appointments/api/use-create-booking-link.ts`
- [ ] `src/features/appointments/components/appointment-calendar-picker-sheet.tsx` (bottom sheet):
  - **Gửi link** → `send=true`; cập nhật trạng thái bot pause trong cache.
  - **Mở link đặt hộ** → `send=false`, mở `url` bằng in-app browser.
- [ ] Mục "Đặt lịch hẹn" trong `composer-actions-sheet.tsx`, chỉ hiện khi kênh hỗ trợ tin có nút.
- [ ] Test hooks (success, lỗi API, optimistic bot state).

### Phase 3 — Tab Appointments trong contact panel (~2–3 ngày)

- [ ] Tab `appointments` trong `src/features/contacts/contact-panel.tsx`.
- [ ] `use-contact-appointments.ts` (phụ thuộc backend Phase 0).
- [ ] Card: giờ theo `inviteeTimezone`, tên calendar, badge Scheduled/Cancelled, nút Huỷ (confirm) → `use-cancel-appointment.ts`.
- [ ] Tạo lịch native — `create-appointment-sheet.tsx`:
  1. Chọn calendar.
  2. Chọn timezone (mặc định timezone calendar).
  3. Chọn ngày (chỉ bật ngày có slot) → chọn giờ.
  4. Footer hiển thị giờ đã chọn + nút Tạo → `use-book-appointment.ts`.
  5. Notice khi không có conversation ("khách sẽ không được thông báo").
  6. Xử lý lỗi stale slot / availability changed / 409 → báo lỗi + refetch.
- [ ] Lib thuần cho slot grouping theo ngày/timezone (`src/features/appointments/lib/group-slots.ts`) + test DST.

### Phase 4 — Tính năng nhanh (~1.5 ngày)

- [ ] Notes CRUD: `/v1/contacts/{identifier}/notes` (GET/POST), `/notes/{noteId}` (PUT/DELETE).
- [ ] Resend tin lỗi trong `message-actions-menu.tsx`.
- [ ] WhatsApp template picker khi window đóng.

### Phase 5 — Tuỳ chọn

Pipelines/deals, translation, send products, các section read-only.

## 5. Quy ước áp dụng

- Hook đặt tại `src/features/<feature>/api/use-<thing>.ts`; `throw new ApiError(error)` khi `openapi-fetch` trả lỗi; optimistic + rollback cho mutation.
- UI dạng bottom sheet `@gorhom/bottom-sheet` (`*-sheet.tsx`).
- TDD: test `*.test.ts(x)` cạnh file, jest-expo.
- i18n: thêm key cho đủ 20 locale; cập nhật `src/i18n/locales-completeness.test.ts` nếu cần.
- Không stage / commit khi chưa được yêu cầu.

## 6. Rủi ro

| Mức    | Rủi ro                                               | Giảm thiểu                                           |
| ------ | ---------------------------------------------------- | ---------------------------------------------------- |
| HIGH   | Không có `/v1` list appointment theo contact         | Sửa backend (Phase 0); nếu không, tab chỉ có tạo/huỷ |
| MEDIUM | Slot picker native phức tạp (timezone, 90 ngày, DST) | Phase 2 cung cấp WebView picker trước làm fallback   |
| MEDIUM | Regenerate schema đổi type code hiện có              | Chạy `tsc` + test toàn bộ sau regenerate             |
| LOW    | Không có reschedule                                  | Hướng dẫn cancel + book lại                          |
| LOW    | Không có realtime cho appointment                    | Invalidate query sau mutation + khi focus màn hình   |

## 7. Ước lượng

Phase 0–1: ~1 ngày · Phase 2: ~1 ngày · Phase 3: 2–3 ngày · Phase 4: ~1.5 ngày.

## 8. Câu hỏi mở

1. Phạm vi: Phase 0–3 trước, hay gộp Phase 4?
2. Có được sửa backend aha.chat để thêm filter `contactId` không?
3. Tạo lịch: slot picker native ngay, hay dùng WebView picker trước?
