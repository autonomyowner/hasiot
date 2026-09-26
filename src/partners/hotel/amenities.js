/**
 * The amenities a host can switch on — the app's closed list
 * (hasio-mobile-app/constants/amenities.ts), keys and labels only. The key is
 * what is stored; a legacy free-text amenity on a stored listing is carried
 * through an edit untouched and shown as typed.
 */
export const AMENITIES = [
  { key: 'wifi', en: 'Wi-Fi', ar: 'واي فاي' },
  { key: 'parking', en: 'Parking', ar: 'موقف سيارات' },
  { key: 'ac', en: 'Air conditioning', ar: 'تكييف' },
  { key: 'breakfast', en: 'Breakfast', ar: 'إفطار' },
  { key: 'restaurant', en: 'Restaurant', ar: 'مطعم' },
  { key: 'pool', en: 'Swimming pool', ar: 'مسبح' },
  { key: 'gym', en: 'Gym', ar: 'نادي رياضي' },
  { key: 'tv', en: 'TV', ar: 'تلفاز' },
  { key: 'laundry', en: 'Laundry', ar: 'خدمة غسيل' },
  { key: 'room_service', en: 'Room service', ar: 'خدمة الغرف' },
  { key: 'reception_24h', en: '24-hour reception', ar: 'استقبال ٢٤ ساعة' },
  { key: 'elevator', en: 'Elevator', ar: 'مصعد' },
  { key: 'family_rooms', en: 'Family rooms', ar: 'غرف عائلية' },
  { key: 'prayer_room', en: 'Prayer room', ar: 'مصلى' },
  { key: 'kitchen', en: 'Kitchenette', ar: 'مطبخ صغير' },
  { key: 'airport_shuttle', en: 'Airport shuttle', ar: 'نقل من المطار' },
  { key: 'garden', en: 'Garden or terrace', ar: 'حديقة أو تراس' },
  { key: 'non_smoking', en: 'Non-smoking rooms', ar: 'غرف لغير المدخنين' },
]
