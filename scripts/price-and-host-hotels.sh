#!/usr/bin/env bash
# Make the remaining eight production hotels bookable.
#
# WHY BOTH STEPS: `isBookableStay` gates the Book button on price alone, but
# the host confirm path requires `listing.ownerId === user._id`. A priced hotel
# with no owner shows a Book button, accepts the request, and then the hourly
# `expirePendingRequests` cron kills it and tells the guest it expired. Price
# and host must land together — never run step 2 without step 3.
#
# PREREQUISITE: the Convex CLI on this machine is logged into the wrong
# account. `~/.convex/config.json` holds a token for "maamoun youcef's team",
# whose only project is `twinshop`, which is why every `convex run --prod`
# answers "You don't have access to the selected project". Fix it first:
#
#     npx convex login
#
# Sign in as the account that owns the `hearty-ram-74` deployment, then run
# this script. Nothing here works until that is done.

set -euo pipefail

# The account that will host the hotels. It must already exist in `users` —
# it is the admin/concierge account, not a new one.
HOST_EMAIL="${HOST_EMAIL:-autonomy.owner@gmail.com}"

cd "$(dirname "$0")/.."

# `convex deploy` ships the WORKING TREE, not HEAD. On 2026-09-12 this tree held
# an uncommitted rewrite of the travel planner's system prompt from another
# session — deploying blind would have pushed an unfinished prompt to every
# live app. Refuse to deploy while convex/ has uncommitted changes.
DIRTY="$(git status --porcelain -- convex/ | grep -v '^??' || true)"
if [ -n "$DIRTY" ]; then
  echo "REFUSING TO DEPLOY — convex/ has uncommitted changes:"
  echo "$DIRTY"
  echo
  echo "Commit them, stash them, or check them out before running this."
  echo "Deploying would push them to production along with the pricing work."
  exit 1
fi

echo "==> 1/4  Deploy the backend first. hostAllOwnerlessHotels is new code;"
echo "         it does not exist on production yet."
npx convex deploy --yes

echo
echo "==> 2/4  Price every unpriced hotel, by class, in SAR."
echo "         Never overwrites a rate that already exists, so the two hotels"
echo "         that are already priced (Rose Garden 420, Swiss Intl 200) are"
echo "         left exactly as they are."
npx convex run admin/devTools:setEstimatedRates '{}' --prod

echo
echo "==> 3/4  Give every ownerless hotel a host, so those bookings can be"
echo "         confirmed. Skips anything hidden by isActive:false."
npx convex run admin/devTools:hostAllOwnerlessHotels "{\"email\":\"${HOST_EMAIL}\"}" --prod

echo
echo "==> 4/4  Verify against the live deployment."
curl -s -X POST "https://hearty-ram-74.eu-west-1.convex.cloud/api/query" \
  -H "Content-Type: application/json" \
  -d '{"path":"listings/queries:listListings","args":{"type":"hotel"},"format":"json"}' \
  | python -c "
import sys, json
v = json.load(sys.stdin)['value']
ok = [x for x in v if x.get('pricePerNight') and x.get('ownerId')]
print()
for x in v:
    price = x.get('pricePerNight')
    owner = 'yes' if x.get('ownerId') else 'NO'
    mark = 'BOOKABLE' if (price and x.get('ownerId')) else '--------'
    print(f\"{mark}  {str(x.get('name_en'))[:44]:46} {str(price):>7} SAR  host={owner}\")
print()
print(f'{len(ok)} of {len(v)} hotels are bookable.')
"

echo
echo "NOTE: the concierge account now owns these listings, and createStayBooking"
echo "      refuses a booking on your own listing (OWN_LISTING). Test the flow"
echo "      from a different account, or it will look broken."
