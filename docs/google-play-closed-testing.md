# Google Play Closed Testing — AUC (AI Universal Converter)

I have no access to your Play Console account, so I cannot check whether it is a **Personal** or **Organization** developer account, or its creation date. This determines whether the 12-tester / 14-day closed-testing requirement applies before Production access can be requested. **Confirm this yourself in Play Console → Account details before assuming either path.**

- If the account is an **Organization** account, or a **Personal** account created **before 13 November 2023**: the 12-tester/14-day gate generally does not apply the same way — check current requirements in Play Console, as Google's policy has changed over time.
- If the account is a **Personal** account created **on or after 13 November 2023**: Google requires, before Production access can be requested:
  - A live **closed test** with **at least 12 testers**
  - Those testers **opted in and remained opted in continuously for at least 14 days**
  - This is enforced by Play Console itself — it will not offer a path to Production until the requirement shows as met.

Do not tell Google, or claim to yourself, that AUC is production-ready if this requirement applies and hasn't been met yet.

## Step-by-step: creating the closed test (owner action, in Play Console)

1. **Play Console → your app → Testing → Closed testing.**
2. Create a new closed track (e.g. "Closed testing — Alpha").
3. Upload the release: `build/app/outputs/bundle/release/app-release.aab` (see the Phase 3 final report for the exact path and file size).
4. Fill in release notes, e.g.: *"Initial closed test build of AUC — AI Universal Converter. Includes local + AI-assisted natural-language unit conversion, Thai local units, scientific/engineering units, history/favorites, and a single banner ad."*
5. Complete the required Play Console sections before a closed track can go live: **Store listing**, **App content** (content rating, target audience, ads declaration, data safety, privacy policy URL), and **App access** (declare the app needs no special access, since there's no login).
6. Save and roll out the closed test.

## Tester list

Play Console accepts testers as:
- **Email list** — a plain list of Google account email addresses, one per line, pasted into the console, e.g.:
  ```
  tester1@example.com
  tester2@example.com
  tester3@example.com
  ```
- or a **Google Group** email — anyone in the group is automatically a tester.

You need **12 distinct** testers if the 2023+ Personal-account gate applies. Recruit from people who will actually install and open the app, not addresses that will never opt in — Google counts *active, opted-in* testers, not just invited ones.

## Tester opt-in process (what each tester does)

1. You send each tester the **opt-in URL** Play Console generates for the closed track (Testing → Closed testing → your track → "Testers" tab → copy the opt-in link).
2. The tester opens that link **while signed into the Google account you added**, taps "Become a tester", then installs AUC from the Play Store link the same page provides.
3. The tester must actually **open the app at least once** — Play only counts testers who both opted in and installed/ran the build.

## Test instructions to send testers (adapt as needed)

> Thanks for testing AUC — AI Universal Converter. Please try:
> - A simple conversion: "10 km to miles"
> - A Thai conversion (if you read Thai): "3 ไร่ 4 งาน เป็นกี่ตารางเมตร"
> - Something the app might not recognize, to see how it asks for help
> - Copy and Share on a result
> - History and Favorites after closing and reopening the app
>
> Please report anything confusing, incorrect, or crashing to: sarayuth939@gmail.com

## Feedback process

- Primary channel: the support email above.
- Optional: Play Console's own "Closed testing feedback" surfaces tester-submitted feedback and crash reports directly — check this periodically during the test window.

## 14-day tracking checklist (if the 2023+ gate applies)

- [ ] Closed track created and rolled out
- [ ] AAB uploaded and processed without errors in Play Console
- [ ] Store listing, content rating, data safety, and privacy policy URL all completed (Play blocks a closed-test rollout otherwise)
- [ ] 12+ testers added by email/group
- [ ] Day 0: confirm each tester has opted in **and** installed the app (Play Console → Testers tab shows install counts)
- [ ] Days 1–14: testers remain opted in continuously — removing and re-adding a tester can reset their clock, so avoid churn
- [ ] Day 14+: Play Console's Production track eligibility should now show the requirement as met — verify there before requesting Production access
- [ ] Collect and triage tester feedback throughout, not just at the end

## Production access preparation (after the closed test requirement, if any, is satisfied)

1. Play Console → Production → Create release, promote the same (or an updated) AAB.
2. Re-confirm store listing, data safety, and content rating are still accurate as of the release you're promoting.
3. Submit for review. Google's review timeline is outside AUC's or this document's control.

This document is preparation only — no step in it can be completed without your Play Console account access.
