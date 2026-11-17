# Mandates

A mandate is a user's promise to upload an oral exam transcript for a category that requires payments.
A mandate allows access to that category immedaitely but requires the user upload the mandate at a later date.

## States

States are derived from the values in the mandate rows.

| State                 | Condition                                                              | Account     | Type                           |
| --------------------- | ---------------------------------------------------------------------- | ----------- | ------------------------------ |
| No mandate            | no row                                                                 | ok          | –                              |
| Open                  | `fulfilled_time` null, today <= `due_date`                             | ok          | Open & ongoing                 |
| Open, overdue         | `fulfilled_time` null, today > `due_date`, no active extension         | **blocked** | Open & overdue                 |
| Open, extension       | `fulfilled_time` null, today > `due_date`, active extension            | ok          | Open & overdue                 |
| Awaiting check        | `fulfilled_time` set, `checked_state` null                             | ok          | Awaiting check                 |
| Rejected, in grace    | `rejected`, today <= `grace_until`                                     | ok          | Rejected & grace period        |
| Rejected, overdue     | `rejected`, today > `grace_until`, no active extension                 | **blocked** | Rejected & overdue             |
| Rejected, extension   | as Rejected, overdue, but with an active extension                     | ok          | Rejected & overdue             |
| Accepted              | `accepted`                                                             | ok          | Archived                       |
| Excused               | `excused`                                                              | ok          | Archived                       |

- **Active extension**: nullable column `extended_time`, set to now when a category admin grants the extension. It is active while now < `extended_time` + `MANDATE_EXTENSION_PERIOD` (1 day). The API returns the end as `extended_until`, like `grace_until`.
- **Blocked**: If the user is blocked due to any mandate, they lose access. This is enforced on every request, so the user cannot access anything.
- **Exam access**: any mandate for the category with `due_date` ≥ today, whatever its state, and permanently once it is accepted or excused (`Mandate.categories_with_access`). Otherwise only a legacy payment gives access. Viewing, search, `hasPaid` in the exam metadata, and the exam's cuts, answers and comments all use this rule.
- **Excused** needs no upload, so `fulfilled_time` can be null there. The Open rows only apply while `checked_state` is null.

## Timeline

(Everything in UTC.)

1. **Accept**: `due_date` is the next 1 March or 1 October, so 1 day to 7 months away.
2. **Until `due_date`**: access to the category's paid exams, through the end of that day. This is also the upload deadline.
3. **Day after `due_date`, 00:00** (2 March or 2 October): blocked unless `fulfilled_time` is set or the mandate is excused.
4. **Awaiting check**: no deadline for admins. Waiting never blocks the user.
5. **Rejected**: until the end of `grace_until` = `max(due_date, date of checked_time + 10 d)` (`MANDATE_REJECTION_GRACE_PERIOD`) to resubmit, so never blocked before the day after `due_date`. Blocked from the day after `grace_until`, 00:00. Uploading again clears the rejection.
6. **Extension**: a category admin unblocks a blocking mandate for 24 hours from `extended_time`, so the user can log in and submit their PDF.
   - Submitted in time: the mandate is Awaiting check and no longer blocks.
   - Not submitted: it blocks again after 24 hours. The admin can grant another extension, which restarts the 24 hours.
   - It only stops this mandate from blocking. Other blocking mandates of the user need their own extension, and access to the category's paid exams does not come back.
7. **Accepted / excused**: final, never blocks. Access is permanent so the user will always be able to access the exams once accepted.

## Transitions

| Transition                                 | Endpoint                                      | Who                                    |
| ------------------------------------------ | --------------------------------------------- | -------------------------------------- |
| → Open (one mandate per user and category) | `POST /api/mandates/`                         | user for themselves, (category) admin for anyone in that category |
| Open / Rejected → Awaiting check           | `POST /api/exam/upload/transcript/`           | owner, by uploading to the category    |
| Awaiting check / Rejected → Accepted       | `POST /api/mandates/{id}/check/`              | (category) admin                       |
| Awaiting check → Rejected                  | `POST /api/mandates/{id}/check/`              | (category) admin                       |
| Any but Accepted / Excused → Excused       | `POST /api/mandates/{id}/check/`              | (category) admin                       |
| Awaiting check       / Rejected → Accepted | `POST /api/payment/markexamchecked/{file}/`   | (category) admin ("mark checked" on the exam page) |
| Open / Rejected, overdue → extension       | `POST /api/mandates/{id}/extend/`             | (category) admin                       |
| → No mandate (only way to cancel)          | `DELETE /api/mandates/{id}/`                  | (category) admin                         |

- An upload sets `fulfilled_time` and `uploaded_transcript` on the uploader's Open or Rejected mandate in that category and clears a rejection. Mandates in other states stay unchanged.
- `markexamchecked` accepts the uploader's fulfilled mandate in the exam's category, if there is one.
- `extend/` only works on a mandate that blocks right now (ignoring extensions); granting it again restarts the 24 hours.
- `check/` needs an upload (`fulfilled_time`) to accept or reject, even if the file was deleted since. Excusing works without one and leaves `fulfilled_time` null. Accepted and excused are final, so `check/` refuses them with a 400. Accepting also marks the transcript as checked and public, like `markexamchecked`.
- Deleting the transcript (`remove/exam/`, (category) admin only) only clears `uploaded_transcript`. The mandate keeps its state, whatever it is.
