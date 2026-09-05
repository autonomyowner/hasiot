import { internalMutation } from "../_generated/server";

// Curated Unsplash images for Al-Ahsa listings.
//
// These are hotlinks, so they rot: five of the original 64 now 404 because the
// photographers withdrew them, and the breakage is silent — the card just shows
// a grey frame. They were removed from this map and from production
// (`photoTools:dropDeadImages`). Before adding another, curl it.
//
// Real photographs uploaded to Convex storage are the better path and cannot
// 404; see `photoTools:attachListingImages`.
const imageMap: Record<string, string[]> = {
  // === HOTELS - Hofuf ===
  "InterContinental Al Ahsa": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
  ],
  "Ramada by Wyndham Al Ahsa": [
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80",
  ],
  "Holiday Inn Al Ahsa": [
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80",
  ],
  "Al Ahsa Grand Hotel": [
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
  ],
  "Garden Plaza Hotel Al Ahsa": [
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80",
  ],
  "Rose Garden Hotel Hofuf": [
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
  ],
  "Braira Al Ahsa Hotel": [
    "https://images.unsplash.com/photo-1606402179428-a57976d71fa4?w=800&q=80",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
  ],
  "Swiss International Palace Hotel": [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80",
    "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800&q=80",
  ],

  // === HOTELS - Mubarraz ===
  "Al Koot Heritage Hotel": [
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80",
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80",
  ],
  "Golden Tulip Al Ahsa": [
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
  ],
  "Oasis Suites Al Ahsa": [
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80",
    "https://images.unsplash.com/photo-1560200353-ce0a76b1d438?w=800&q=80",
  ],
  "Palm Resort Al Ahsa": [
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80",
    "https://images.unsplash.com/photo-1615460549969-36fa19521a4f?w=800&q=80",
  ],

  // === RESTAURANTS - Hofuf ===
  "Al Hasawi Kitchen": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  ],
  "Bait Al Qahwa": [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80",
  ],
  "Al Romansiah Al Ahsa": [
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80",
  ],
  "Mama Noura Al Ahsa": [
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  ],
  "Dar Al Tammar": [
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
  ],
  "Al Baik Al Ahsa": [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=800&q=80",
  ],
  "Mashawi Al Oasis": [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&q=80",
  ],
  "Al Waha Seafood": [
    "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800&q=80",
    "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
  ],
  "Bab Al Hasa": [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
  ],
  "Mathlouta House": [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80",
  ],

  // === RESTAURANTS - Mubarraz & Other ===
  "Deira Restaurant": [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
  ],
  "Spring Cafe Al Oyoun": [
    "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
    "https://images.unsplash.com/photo-1442512595331-e89e73853f31?w=800&q=80",
  ],
  "Al Omran Grills": [
    "https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80",
    "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=800&q=80",
  ],
  "Hasawi Dates Bistro": [
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&q=80",
  ],
  "Al Jafr Fish House": [
    "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800&q=80",
    "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
  ],
  "Oasis Garden Restaurant": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
  ],

  // === ATTRACTIONS ===
  "Al-Ahsa Oasis": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  ],
  "Ibrahim Palace": [
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
  ],
  "Al Qarah Mountain": [
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
  ],
  "Souq Al Qaisariya": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Jawatha Mosque": [
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=80",
  ],
  "Yellow Lake (Asfar Lake)": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
  ],
  "Al Koot Fortress": [
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Al-Ahsa National Museum": [
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=80",
  ],
  "Ain Najm Spring": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  ],
  "Ain Al Hara Spring": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  ],
  "Al-Ahsa Date Market": [
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
  ],
  "Land of Civilizations Museum": [
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=80",
  ],
  "Al Oyoun Village": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  ],
  "Al Shabah Cave": [
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
  ],
  "Hofuf Old Quarter": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Al-Ahsa Palm Farms": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
  ],
  "Al Mubarraz Corniche": [
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80",
  ],
  "Al Uqair Beach & Fort": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],

  // === EVENTS & TOURS ===
  "Al-Ahsa Dates Festival": [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  ],
  "Al-Ahsa Heritage Festival": [
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
  ],
  "Al Qarah Caves Tour": [
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
  ],
  "Oasis Heritage Walking Tour": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Al-Ahsa Desert Safari": [
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
  ],
  "Palm Farm Experience": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
  ],
  "Al Uqair Coastal Trip": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
  ],
  "Hasawi Nights": [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80",
  ],
  "Natural Springs Tour": [
    "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  ],
  "Al-Ahsa Food Festival": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
  ],
};

// One-time migration: add images to all listings that don't have them
export const addImagesToListings = internalMutation({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    let updated = 0;

    for (const listing of listings) {
      // Skip if already has images
      if (listing.images && listing.images.length > 0) continue;

      const images = imageMap[listing.name_en];
      if (images) {
        await ctx.db.patch(listing._id, { images });
        updated++;
      }
    }

    return { total: listings.length, updated };
  },
});
