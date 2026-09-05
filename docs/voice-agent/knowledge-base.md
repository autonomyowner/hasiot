# Hasio — knowledge base for the website voice agent

Upload this file as a knowledge-base document on the ElevenLabs agent.

Written in short, self-contained sections because retrieval pulls chunks, not whole
documents — each section has to make sense on its own. Everything here is verified.
**If a fact is not in this file, the agent does not know it.** That is deliberate: the
system prompt forbids inventing figures, so gaps here become honest "I don't know"s
rather than confident errors.

---

## What Hasio is

Hasio is a travel platform for the Eastern Province of Saudi Arabia. It is a mobile app for
iPhone and Android that helps people discover, plan, and book a trip anywhere in the
province. It works fully in both Arabic and English.

Hasio is focused on the Eastern Province specifically, not on Saudi Arabia as a whole. That
focus is the point: it covers one region in real depth rather than the whole country
shallowly. It started as an Al-Ahsa guide, and Al-Ahsa is still the part it knows best.

The brand is written as "Hasio" in Latin letters in both languages — that is the logo and
the written form everywhere. In spoken Arabic it is pronounced هاسيو.

## The cities Hasio covers

Hasio covers thirteen governorates and cities of the Eastern Province: Dammam, Al Khobar,
Al Ahsa, Qatif, Jubail, Hafar Al Batin, Khafji, Ras Tanura, Abqaiq, Nairyah, Qaryat Al
Ulya, Al Udayd, and Al Bayda. Dhahran is treated as part of Al Khobar; Saihat, Safwa, Darin
and Tarout as part of Qatif; Hofuf, Mubarraz and Al Oyoun as areas inside Al Ahsa.

Nothing outside the Eastern Province is covered — not Riyadh, not Jeddah, not Makkah.

The province is large, and distances matter when planning: Dammam to Hafar Al Batin is
roughly a five-hour drive, and Dammam to Al-Ahsa about an hour and a half. Always find out
which city someone is based in before suggesting a day plan.

The province has a coast — the Gulf, corniches, beaches and diving off Al Khobar, Dammam,
Ras Tanura, Jubail and Khafji — as well as the oasis, the desert and the mountains inland.

## About Al-Ahsa, the heart of the platform

Al-Ahsa is the largest governorate in Saudi Arabia's Eastern Province, named after the
Al-Ahsa Oasis. In Classical Arabic, "Ahsa" means the sound of water running underground —
a reference to the natural springs beneath it.

It has been a UNESCO World Heritage Site since 2018. It is the largest palm oasis in the
world and holds a Guinness World Record for it, with more than three million date palms
across roughly eighty-five square kilometres. It is one of the oldest continuously
settled places on the Arabian Peninsula, with a history going back more than six thousand
years. The landscape includes springs, caves, mountains, and heritage mudbrick sites.

The main areas inside Al-Ahsa are Hofuf, Mubarraz, Al Oyoun, and Al Omran.

## What the app does

**AI travel planner.** A conversation, not a form. It asks follow-up questions about who
is travelling, for how long, and what they enjoy, then builds a full itinerary. It replies
in whichever language the traveller uses. It is text-based — there is no voice assistant
inside the app.

**Directory and map.** Hotels, restaurants, attractions, events, and tours across the
Eastern Province, shown on a map and searchable in Arabic and English. Listings carry photos, working hours,
and location.

**Trip itinerary builder.** Travellers build a day-by-day trip by adding stops with dates,
times, and notes, and can reorder them. A plan produced by the AI planner can be turned
into a real editable trip in one step.

**Bookings.** Reservations for stays, tour bookings, and event tickets, with the business
confirming on their side.

**Services marketplace.** Licensed local freelancers — guides, photographers, drivers,
translators, event planners, caterers, and equipment rental.

**Favourites.** Travellers can save places they like.

## Where to get the app

Hasio is live on both the Apple App Store and Google Play. The Android package name is
com.hasio.travel. It is available in eight countries: Saudi Arabia, the United Arab
Emirates, Kuwait, Qatar, Bahrain, Oman, Algeria, and Australia.

The app is free to download.

The website is hasio.xyz. Support email is support@hasio.xyz — when speaking it aloud, say
"support at hasio dot x-y-z" slowly.

## Who can use Hasio, and how accounts work

There are three kinds of account.

**Travellers** sign up and get access immediately. No approval needed.

**Business owners** post listings — hotels, restaurants, attractions, and events. They
sign up in the app, upload a verifying document, and are reviewed by the Hasio team before
their listing goes live.

**Service providers** post freelancer services such as guiding, photography, driving, or
translation. Same process: document upload, then review.

Signing up and upgrading an account both happen in the mobile app. There is no sign-up on
the website.

## How listings get approved

Every listing and every service submitted by a business goes through review before the
public sees it. The team either approves it, or rejects it with a reason so the owner can
fix and resubmit. If an owner later edits an approved listing, it goes back for review.

This is why the directory is trustworthy: nothing is self-published. For a licensed guide
or a real hotel, it means they are not competing with unverified listings.

## What it costs a business

Listing a business on Hasio is free. The value to a business is distribution — being found
by travellers who are actively planning a trip to their city, and receiving bookings
directly.

If asked about commission, take rates, or any future pricing: the agent does not have those
figures and should offer to connect the person with the team rather than estimating.

## The AI receptionist for hotels — in development

Hasio is building an AI receptionist that hotels will be able to rent. It answers calls and
WhatsApp messages around the clock in Arabic and English, quotes availability, takes
bookings directly into the property's calendar, and follows up with guests before arrival
and after their stay.

The reason it matters: Saudi rules have moved hotel reception roles to full Saudization,
which makes it far harder and more expensive for a small property to staff a front desk
across all three shifts. The receptionist is designed to cover the hours a property cannot
staff — it supports the receptionist, it does not replace them. Every call answered at
eleven at night is a booking that would otherwise have gone to an online travel agency, or
been lost.

**This product is not released yet.** It is in development. There is no price, no launch
date, and no sign-up. If a hotel is interested, take their property name and a contact and
say the team will reach out about early access.

## Why Hasio exists — the short version

Saudi Arabia had roughly one hundred and twenty-three million tourist visits in twenty
twenty-five, and most of that travel is domestic — Saudis and residents travelling inside
the Kingdom. But outside Riyadh and Jeddah, destinations across the Eastern Province —
Al-Ahsa, Qatif, Jubail, Hafar Al Batin — have almost no digital layer. A traveller planning
a weekend there is piecing it together from social media posts and WhatsApp numbers.

Hasio builds that missing layer: everything worth doing in one place, planned into a real
itinerary, bookable, in Arabic.

## Technology, if asked

The app is built with React Native, with a real-time backend on Convex. The AI planner runs
on Anthropic's Claude models. Maps use Mapbox. The team runs an internal Arabic admin
console for reviewing and approving listings.

Keep this brief unless the person is clearly technical.

## Common questions

**Is Hasio only for Al-Ahsa?** No. Hasio covers the whole Eastern Province — Dammam, Al
Khobar, Al Ahsa, Qatif, Jubail, Hafar Al Batin and the rest. It began as an Al-Ahsa guide,
which is why the oasis is still the part it covers in most depth, but the app is for the
province. It does not cover the rest of Saudi Arabia; that focus is intentional — depth
over breadth.

**Do I need an account to browse?** Travellers can sign up quickly and free. Booking and
saving favourites need an account.

**Is it in Arabic?** Fully — the whole app works in Arabic with right-to-left layout, and
in English. Not a translation layer; it was built for both.

**Can I book a guide through the app?** Yes, through the services marketplace, and every
provider there has been document-verified by the team.

**Is there a website version of the app?** No. The website is an information page; the
product is the mobile app.

**Who is behind Hasio?** A small team building for the Eastern Province. If they want to speak to
someone directly, offer to pass their details on.

---

## Deliberately not in this knowledge base

Do not add these without checking first — the agent will state whatever is here as fact:

- Download numbers, user counts, revenue, or number of businesses signed up
- Market-size figures from the investor deck (those are modelled, not sourced)
- Any price, commission, or take rate
- Launch dates for the AI receptionist
- Named partnerships, investors, or customers
- Features on unreleased branches — currency switching and the redesigned tab bar are
  built but not shipped, so they do not belong here until they are in a store release
