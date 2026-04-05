import { mutation } from "../_generated/server";

// Curated Unsplash images for Saudi Arabia listings
const imageMap: Record<string, string[]> = {
  // === HOTELS - Riyadh ===
  "The Ritz-Carlton Riyadh": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771eb?w=800&q=80",
  ],
  "Four Seasons Hotel Riyadh": [
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
    "https://images.unsplash.com/photo-1618773928121-c32242e63f39?w=800&q=80",
  ],
  "Marriott Hotel Riyadh": [
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80",
    "https://images.unsplash.com/photo-1590490360182-c33d82de0e5c?w=800&q=80",
  ],
  "Hilton Riyadh Hotel & Residences": [
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80",
  ],
  "Hyatt Regency Riyadh Olaya": [
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
  ],
  "Novotel Riyadh Al Anoud": [
    "https://images.unsplash.com/photo-1606402179428-a57976d71fa4?w=800&q=80",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
  ],
  "Holiday Inn Riyadh Izdihar": [
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80",
    "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=800&q=80",
  ],
  "Narcissus Hotel & Spa Riyadh": [
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80",
    "https://images.unsplash.com/photo-1615460549969-36fa19521a4f?w=800&q=80",
  ],
  "Centro Waha by Rotana": [
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80",
    "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800&q=80",
  ],
  "Al Faisaliah Hotel": [
    "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?w=800&q=80",
    "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?w=800&q=80",
  ],

  // === HOTELS - Jeddah ===
  "Park Hyatt Jeddah": [
    "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=800&q=80",
    "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?w=800&q=80",
  ],
  "Rosewood Jeddah": [
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80",
    "https://images.unsplash.com/photo-1560200353-ce0a76b1d438?w=800&q=80",
  ],
  "Waldorf Astoria Jeddah Qasr Al Sharq": [
    "https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&q=80",
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800&q=80",
  ],
  "Jeddah Hilton Hotel": [
    "https://images.unsplash.com/photo-1586611292717-f828b167408c?w=800&q=80",
    "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=800&q=80",
  ],
  "Radisson Blu Hotel Jeddah": [
    "https://images.unsplash.com/photo-1549294413-26f195200c16?w=800&q=80",
    "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&q=80",
  ],
  "Elaf Jeddah Hotel": [
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?w=800&q=80",
    "https://images.unsplash.com/photo-1594563703937-fdc8ff3651e3?w=800&q=80",
  ],
  "Swiss-Belhotel Jeddah": [
    "https://images.unsplash.com/photo-1625244724120-1fd1d34d00f6?w=800&q=80",
    "https://images.unsplash.com/photo-1576354302919-96748cb8299e?w=800&q=80",
  ],
  "Makarem Annakheel Hotel & Resort": [
    "https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?w=800&q=80",
    "https://images.unsplash.com/photo-1573052905904-34ad8c27f0cc?w=800&q=80",
  ],

  // === HOTELS - Mecca ===
  "Raffles Makkah Palace": [
    "https://images.unsplash.com/photo-1591825729269-caeb344f6df2?w=800&q=80",
    "https://images.unsplash.com/photo-1566665797739-1674de7a421a?w=800&q=80",
  ],
  "Swissotel Makkah": [
    "https://images.unsplash.com/photo-1587213811864-46e59f6873b1?w=800&q=80",
    "https://images.unsplash.com/photo-1582719508461-905c673771eb?w=800&q=80",
  ],
  "Hilton Suites Makkah": [
    "https://images.unsplash.com/photo-1564501049412-61c2a3083791?w=800&q=80",
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&q=80",
  ],
  "Dar Al Tawhid InterContinental": [
    "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80",
    "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80",
  ],

  // === HOTELS - Medina ===
  "The Oberoi Medina": [
    "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=800&q=80",
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?w=800&q=80",
  ],
  "Dar Al Iman InterContinental": [
    "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=800&q=80",
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&q=80",
  ],
  "Crowne Plaza Medina": [
    "https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=800&q=80",
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80",
  ],
  "Millennium Al Aqeeq Hotel": [
    "https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=800&q=80",
    "https://images.unsplash.com/photo-1606402179428-a57976d71fa4?w=800&q=80",
  ],

  // === HOTELS - Other Cities ===
  "Kempinski Hotel Al Othman": [
    "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    "https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80",
  ],
  "Sheraton Dammam Hotel": [
    "https://images.unsplash.com/photo-1455587734955-081b22074882?w=800&q=80",
    "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?w=800&q=80",
  ],
  "Habitas AlUla": [
    "https://images.unsplash.com/photo-1618140052121-39fc6db33972?w=800&q=80",
    "https://images.unsplash.com/photo-1602002418816-5c0aeef426aa?w=800&q=80",
  ],
  "Banyan Tree AlUla": [
    "https://images.unsplash.com/photo-1610641818989-c2051b5e2cfd?w=800&q=80",
    "https://images.unsplash.com/photo-1573052905904-34ad8c27f0cc?w=800&q=80",
  ],
  "InterContinental Abha": [
    "https://images.unsplash.com/photo-1568084680786-a84f91d1153c?w=800&q=80",
    "https://images.unsplash.com/photo-1551918120-9739cb430c6d?w=800&q=80",
  ],

  // === RESTAURANTS - Riyadh ===
  "Najd Village": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  ],
  "Lusin": [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
  ],
  "Globe Restaurant": [
    "https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&q=80",
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&q=80",
  ],
  "Mama Noura": [
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  ],
  "Al Baik": [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=800&q=80",
  ],
  "Takya": [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80",
  ],
  "Nusr-Et Steakhouse": [
    "https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80",
    "https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=800&q=80",
  ],
  "Jinaah": [
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=800&q=80",
  ],
  "The Butcher Shop & Grill": [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    "https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=800&q=80",
  ],
  "Myazu": [
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
    "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80",
  ],
  "Al Romansiah": [
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80",
  ],
  "Suhail Restaurant": [
    "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
  ],

  // === RESTAURANTS - Jeddah ===
  "Al Nakheel Restaurant": [
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
    "https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&q=80",
  ],
  "Twina Restaurant": [
    "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
    "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800&q=80",
  ],
  "Bab Al Yaman": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
  ],
  "Pier 7": [
    "https://images.unsplash.com/photo-1550966871-3ed3cdb51f3a?w=800&q=80",
    "https://images.unsplash.com/photo-1544148103-0773bf10d330?w=800&q=80",
  ],
  "Al Baik Jeddah": [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    "https://images.unsplash.com/photo-1513185158878-8d8c2a2a3da3?w=800&q=80",
  ],
  "Mataam Al Sharq": [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    "https://images.unsplash.com/photo-1601050690597-df0568f70950?w=800&q=80",
  ],
  "Sakura Japanese Restaurant": [
    "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=800&q=80",
    "https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80",
  ],
  "Burgerizzr": [
    "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&q=80",
    "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800&q=80",
  ],
  "Habara Bukhari Restaurant": [
    "https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800&q=80",
    "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=800&q=80",
  ],
  "Crab House": [
    "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800&q=80",
    "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
  ],

  // === RESTAURANTS - Other Cities ===
  "Heritage Village Restaurant": [
    "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&q=80",
  ],
  "Maharaja Palace": [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&q=80",
    "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80",
  ],
  "Asir Kitchen": [
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80",
  ],
  "Dammam Fish Market": [
    "https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=800&q=80",
    "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?w=800&q=80",
  ],
  "Sarat Mountain Grill": [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    "https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=800&q=80",
  ],

  // === ATTRACTIONS ===
  "Diriyah - At-Turaif District": [
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
  ],
  "National Museum of Saudi Arabia": [
    "https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=800&q=80",
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=80",
  ],
  "Al Balad - Historic Jeddah": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Hegra (Mada'in Salih)": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
  ],
  "Edge of the World (Jebel Fihrayn)": [
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
  ],
  "Boulevard Riyadh City": [
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80",
  ],
  "Elephant Rock (Jabal Al-Fil)": [
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
  ],
  "Jeddah Corniche": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
  ],
  "King Fahd Fountain": [
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
  ],
  "Al Wahbah Crater": [
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  ],
  "Farasan Islands": [
    "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80",
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  ],
  "Masmak Fortress": [
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
    "https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=800&q=80",
  ],
  "The Red Sea Coast": [
    "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80",
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
  ],
  "Al Soudah Park": [
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  ],
  "Ithra (King Abdulaziz Center)": [
    "https://images.unsplash.com/photo-1554907984-15263bfd63bd?w=800&q=80",
    "https://images.unsplash.com/photo-1565060169194-19fabf63012c?w=800&q=80",
  ],
  "Half Moon Bay": [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?w=800&q=80",
  ],
  "Rijal Almaa Heritage Village": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Maraya Concert Hall": [
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80",
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
  ],
  "Taif Rose Farms": [
    "https://images.unsplash.com/photo-1490750967868-88aa4f44baee?w=800&q=80",
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
  ],
  "King Abdullah Economic City": [
    "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=800&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80",
  ],

  // === EVENTS & TOURS ===
  "Riyadh Season": [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  ],
  "Jeddah Season": [
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
  ],
  "AlUla Heritage Tour": [
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
  ],
  "Desert Safari - Red Sand Dunes": [
    "https://images.unsplash.com/photo-1451337516015-6b6e9a44a8a3?w=800&q=80",
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
  ],
  "Red Sea Diving - NEOM": [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800&q=80",
    "https://images.unsplash.com/photo-1559128010-7c1ad6e1b6a5?w=800&q=80",
  ],
  "Edge of the World Hiking": [
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    "https://images.unsplash.com/photo-1547234935-80c7145ec969?w=800&q=80",
  ],
  "AlUla Moments Festival": [
    "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&q=80",
    "https://images.unsplash.com/photo-1514565131-fce0801e5785?w=800&q=80",
  ],
  "Jeddah Old Town Walking Tour": [
    "https://images.unsplash.com/photo-1578895101408-1a36b834405b?w=800&q=80",
    "https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?w=800&q=80",
  ],
  "Asir Highland Nature Tour": [
    "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80",
    "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
  ],
  "Saudi Cup Horse Race": [
    "https://images.unsplash.com/photo-1529088746738-c4c0a152fb2c?w=800&q=80",
    "https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800&q=80",
  ],
};

// One-time migration: add images to all listings that don't have them
export const addImagesToListings = mutation({
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
