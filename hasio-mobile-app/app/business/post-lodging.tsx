import { appAlert } from "@/stores/dialogStore";
import React, { useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Platform,
  type TextInput,
} from "react-native";
import { ThemedTextInput } from "@/components/ui/ThemedTextInput";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import Animated from "react-native-reanimated";
import { enterFade } from "@/constants/motion";
import { PhotoPickerField } from "@/components/hosting/PhotoPickerField";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/backend";
import { useLanguage } from "@/hooks/useLanguage";
import { getSubmitErrorKey } from "@/lib/submitError";
import { useKeyboardOverlap } from "@/hooks/useKeyboardOverlap";
import { uploadMultipleToConvex } from "@/lib/convexUpload";
import {
  EMPTY_STAY_FORM,
  editedStayLocation,
  firstError,
  isLive,
  isLocalPhoto,
  newStayLocation,
  normaliseTime,
  ownerStatusOf,
  parseWholeNumber,
  sameValues,
  stayFormFromListing,
  validateStayForm,
  withUploadedPhotos,
  type FieldErrors,
  type StayField,
  type StayFormValues,
} from "@/lib/listingForm";
import { toLatinDigits } from "@/lib/digits";
import { BackButton, Button } from "@/components/ui";
import { LodgingType } from "@/types";
import type { Id } from "../../../convex/_generated/dataModel";
import { Feather } from "@expo/vector-icons";
import { AMENITIES } from "@/constants/amenities";
import { CITIES } from "@/constants/cities";
import { colors, type AppFonts } from "@/constants/colors";
import { lodgingTypeOf } from "@/hooks/useConvexData";
import { useThemedStyles } from "@/hooks/useAppFonts";

const LODGING_TYPES: { value: LodgingType; labelKey: string }[] = [
  { value: "hotel", labelKey: "hotels" },
  { value: "apartment", labelKey: "apartments" },
  { value: "camp", labelKey: "camps" },
  { value: "homestay", labelKey: "homestays" },
];

/** The fields that can be wrong, top to bottom as they appear on screen. */
const FIELD_ORDER: readonly StayField[] = [
  "name",
  "nameAr",
  "city",
  "pricePerNight",
  "maxGuests",
  "unitCount",
  "checkInTime",
  "checkOutTime",
];

/** The booking fields as sent: parsed and checked, `undefined` = not sent. */
type Pricing = {
  pricePerNight?: number;
  currency?: string;
  maxGuests?: number;
  unitCount?: number;
  checkInTime: string;
  checkOutTime: string;
};

export default function PostLodgingScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const navigation = useNavigation();
  const { t, isRTL, language } = useLanguage();
  const {
    ref: keyboardRef,
    overlap: keyboardOverlap,
    onLayout: keyboardOnLayout,
    prepare: prepareKeyboard,
  } = useKeyboardOverlap();
  const submitListing = useMutation(api.listings.mutations.submitListing);
  const updateMyListing = useMutation(api.listings.mutations.updateMyListing);

  // An `id` in the route turns this screen into an editor for a listing the
  // owner already posted. Read from `getMyListings` rather than a lookup of its
  // own: that query is already subscribed on the screen the guest came from,
  // and it is the one that enforces "yours".
  const { id } = useLocalSearchParams<{ id?: string }>();
  const myListings = useQuery(
    api.listings.queries.getMyListings,
    id ? {} : "skip"
  );
  const existing = id
    ? (myListings ?? []).find((listing: any) => listing._id === id)
    : undefined;
  const isEditing = Boolean(id);

  const [isLoading, setIsLoading] = useState(false);
  // Every field in one object: an edit needs the whole form to compare with
  // what it opened with, which a dozen separate states made impossible.
  // Amenities are canonical keys, not typed words — see
  // `constants/amenities.ts` — but a legacy free-text amenity is carried as it
  // is, so an edit never drops it.
  const [form, setForm] = useState<StayFormValues>(EMPTY_STAY_FORM);
  // What the form held when it opened: the empty form, or the listing as it is
  // stored. An edit writes the location only where the host moved away from it.
  const [saved, setSaved] = useState<StayFormValues>(EMPTY_STAY_FORM);
  // Each broken field says so under itself. A single "please fill in all
  // required fields" alert used to leave the host hunting a long form for
  // which one, and the range errors said nothing about the range.
  const [errors, setErrors] = useState<FieldErrors<StayField>>({});
  const set = <K extends keyof StayFormValues>(key: K, value: StayFormValues[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    // An error goes as soon as its field is touched, not on the next submit.
    setErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key as StayField];
      return next;
    });
  };
  // Numbers and times are kept in Latin digits as they are typed: an Arabic
  // keypad types ٤٥٠, which `Number()` reads as NaN, so a price typed the
  // natural way in Arabic was turned away as invalid.
  const setDigits = (key: "pricePerNight" | "maxGuests" | "unitCount" | "checkInTime" | "checkOutTime") =>
    (value: string) => set(key, toLatinDigits(value));
  const toggleAmenity = (key: string) =>
    setForm((current) => ({
      ...current,
      amenities: current.amenities.includes(key)
        ? current.amenities.filter((item) => item !== key)
        : [...current.amenities, key],
    }));

  // Fill the form when the listing lands, once per listing: re-filling on
  // every tick of a live query would overwrite whatever is being typed each
  // time anything else on the account changes. Done during render rather than
  // in an effect, so the first frame of the editor is already the listing.
  const [prefilledId, setPrefilledId] = useState<string | null>(null);
  if (existing && prefilledId !== existing._id) {
    const values = stayFormFromListing(existing);
    setPrefilledId(existing._id);
    setForm(values);
    setSaved(values);
  }

  // Leaving with unsaved work asks first — back button, Android back, iOS
  // swipe — instead of silently dropping a half-filled listing and its
  // photos. Off once the save has gone through, so the success alert's own
  // navigation is not intercepted.
  const [submitted, setSubmitted] = useState(false);
  const dirty = !sameValues(form, saved);
  useLeaveGuard(dirty && !submitted);

  // "Uploading photos 2/5" under the busy button. Stamped per attempt: a
  // failed attempt's other uploads keep finishing in the background, and
  // without the stamp they would move the count of the retry.
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const attempt = useRef(0);

  // For taking the host to the first field with an error: where each field
  // sits in the form, where the form sits in the scroll view, and the inputs
  // that can take focus. Also the return-key chain, field to field.
  const scrollRef = useRef<ScrollView>(null);
  const formY = useRef(0);
  const fieldY = useRef<Partial<Record<StayField, number>>>({});
  const nameRef = useRef<TextInput>(null);
  const nameArRef = useRef<TextInput>(null);
  const neighborhoodRef = useRef<TextInput>(null);
  const priceRangeRef = useRef<TextInput>(null);
  const priceRef = useRef<TextInput>(null);
  const guestsRef = useRef<TextInput>(null);
  const unitsRef = useRef<TextInput>(null);
  const checkInRef = useRef<TextInput>(null);
  const checkOutRef = useRef<TextInput>(null);
  const descriptionRef = useRef<TextInput>(null);
  const descriptionArRef = useRef<TextInput>(null);
  const inputFor: Partial<Record<StayField, React.RefObject<TextInput | null>>> = {
    name: nameRef,
    nameAr: nameArRef,
    pricePerNight: priceRef,
    maxGuests: guestsRef,
    unitCount: unitsRef,
    checkInTime: checkInRef,
    checkOutTime: checkOutRef,
  };

  // A seeded stay's finer category ("luxury_hotel") lights the chip it files
  // under; it is only rewritten if the host picks a different chip.
  const shownType = LODGING_TYPES.some((item) => item.value === form.type)
    ? form.type
    : lodgingTypeOf(form.type);

  // The server skips an undefined number and its validator rejects null, so a
  // stored nightly price, guest cap or unit count cannot be cleared from here
  // (open item: a backend change). When the host empties one, the form says
  // it will be kept rather than pretending the save removed it.
  const cannotClear = (key: "pricePerNight" | "maxGuests" | "unitCount") =>
    isEditing && saved[key] !== "" && form[key].trim() === "";

  // The editor used to open as an empty "new listing" form that filled in a
  // moment later — or never, for a listing that had been deleted, leaving a
  // blank form whose Save failed. Now it waits, or says there is nothing.
  const editorState: "ready" | "loading" | "missing" = !isEditing
    ? "ready"
    : myListings === undefined
      ? "loading"
      : existing
        ? "ready"
        : "missing";

  // Saving an unchanged listing would only send it back to review. A rejected
  // or suspended one may be resubmitted as it is — that is how a host asks
  // for a second look.
  const status = ownerStatusOf(existing?.status);
  const canResubmit = status === "rejected" || status === "suspended";
  const saveDisabled = isEditing && !dirty && !canResubmit;

  const revealField = (field: StayField) => {
    const y = formY.current + (fieldY.current[field] ?? 0);
    scrollRef.current?.scrollTo({ y: Math.max(0, y - 16), animated: true });
    // A text field takes the focus, which brings the keyboard for the fix; the
    // city is chips, so the keyboard goes instead.
    const input = inputFor[field]?.current;
    if (input) input.focus();
    else Keyboard.dismiss();
  };

  const handleSubmit = () => {
    if (isLoading) return;

    // Checked here, before any photo uploads: the server enforces the same
    // limits (lib/listingForm.ts mirrors convex/listings/pricing.ts), and
    // hearing about them after a minute of uploading is a poor trade.
    const found = validateStayForm(form);
    setErrors(found);
    const first = firstError(found, FIELD_ORDER);
    if (first) {
      revealField(first);
      return;
    }

    // Undefined is "leave as stored" to the server, so an empty booking
    // field is simply not sent. The price cannot be cleared that way; the
    // form says so under the field instead of pretending it was.
    const nightly = parseWholeNumber(form.pricePerNight);
    const pricing: Pricing = {
      pricePerNight: nightly,
      currency: nightly !== undefined ? "SAR" : undefined,
      maxGuests: parseWholeNumber(form.maxGuests),
      unitCount: parseWholeNumber(form.unitCount),
      checkInTime: normaliseTime(form.checkInTime),
      checkOutTime: normaliseTime(form.checkOutTime),
    };

    // Any edit sends the listing back to review, and a listing under review
    // is hidden: fixing a price used to take a bookable hotel off the app
    // without a word. A live one asks first.
    if (isEditing && isLive(existing?.status)) {
      appAlert(t("editLiveConfirmTitle"), t("editLiveStayMessage"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("submitForReview"), onPress: () => void save(pricing) },
      ]);
      return;
    }
    void save(pricing);
  };

  const save = async (pricing: Pricing) => {
    setIsLoading(true);
    const thisAttempt = ++attempt.current;

    try {
      // Anything already stored is an https URL and must not be re-uploaded;
      // only what the picker just handed us is a local file. The uploads go
      // back in the places their local files held, so the host's order — and
      // with it the cover — survives the save.
      const localPhotos = form.images.filter(isLocalPhoto);
      const uploaded =
        localPhotos.length > 0
          ? await uploadMultipleToConvex(localPhotos, {
              onProgress: (done, total) => {
                if (attempt.current === thisAttempt) setProgress({ done, total });
              },
            })
          : [];
      const images = withUploadedPhotos(form.images, uploaded);

      const city = form.city.trim();

      if (isEditing && id) {
        // The server resets the listing to pending on any edit, which is why
        // the confirmation says "sent for review" rather than "saved".
        await updateMyListing({
          listingId: id as Id<"listings">,
          type: "hotel",
          name_en: form.name.trim(),
          name_ar: form.nameAr.trim(),
          category: form.type,
          // A seeded stay's stored Arabic label names its old category, and
          // the cards prefer it; once the category changes it is wrong.
          category_ar: form.type !== saved.type ? "" : undefined,
          city,
          // Only what the host changed: the stored pin and address used to
          // be replaced by a city centre and "Eastern Province" on any save.
          ...editedStayLocation(saved, form),
          // "" and [] rather than undefined: the server skips undefined, so
          // an emptied description or a removed last photo was silently kept.
          description_en: form.description.trim(),
          description_ar: form.descriptionAr.trim(),
          priceRange: form.priceRange.trim(),
          amenities: form.amenities,
          images,
          ...pricing,
        });
      } else {
        await submitListing({
          type: "hotel",
          name_en: form.name.trim(),
          name_ar: form.nameAr.trim(),
          category: form.type,
          city,
          ...newStayLocation(form),
          description_en: form.description.trim() || undefined,
          description_ar: form.descriptionAr.trim() || undefined,
          priceRange: form.priceRange.trim() || undefined,
          amenities: form.amenities.length > 0 ? form.amenities : undefined,
          images: images.length > 0 ? images : undefined,
          ...pricing,
        });
      }

      setSubmitted(true);
      appAlert(
        t("success"),
        isEditing ? t("listingUpdated") : t("listingSubmittedForReview"),
        [
          {
            text: t("done"),
            // Only from this screen. The upload can outlast it — a host who
            // left mid-upload is somewhere else by the time this appears,
            // and going back from there popped a screen that had nothing to
            // do with the form.
            onPress: () => {
              if (navigation.isFocused()) router.back();
            },
          },
        ]
      );
    } catch (error) {
      appAlert(t("error"), t(getSubmitErrorKey(error)));
    } finally {
      setIsLoading(false);
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Android: padded by what the keyboard covers (useKeyboardOverlap;
          edge-to-edge Android 15 no longer resizes the window). iOS: the
          scroll view insets itself below. */}
      <View
        ref={keyboardRef}
        onLayout={keyboardOnLayout}
        style={{ flex: 1, paddingBottom: keyboardOverlap }}
      >
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        // Drag the form to put the keyboard away: following the finger on
        // iOS, on the drag on Android, which has nothing interactive.
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        // iOS: inset by the keyboard and scrolled to the focused field. The
        // KeyboardAvoidingView it replaces shrank the whole screen instead,
        // and a field low in the form stayed under the keyboard.
        automaticallyAdjustKeyboardInsets
      >
        {/* Header. The entrances are the app's short staggered fade
            (constants/motion): the form took most of a second to settle
            before it could be filled in. */}
        <Animated.View
          entering={enterFade(0)}
          style={[styles.header, isRTL && styles.headerRTL]}
        >
          <BackButton />
          <Text style={[styles.title, isRTL && styles.textRTL]}>
            {isEditing ? t("editListing") : t("postLodging")}
          </Text>
          {isEditing && editorState === "ready" && (
            <Text style={[styles.editNotice, isRTL && styles.textRTL]}>
              {t("editReviewNotice")}
            </Text>
          )}
        </Animated.View>

        {editorState === "loading" ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={colors.primary.deep} />
          </View>
        ) : editorState === "missing" ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{t("editorNotFound")}</Text>
            <Text style={styles.stateBody}>{t("editorNotFoundHint")}</Text>
            <Button
              title={t("back")}
              variant="outline"
              onPress={() => router.back()}
              style={styles.stateButton}
            />
          </View>
        ) : (
        /* Form. Locked while it submits: a chip tapped mid-upload changed
           the form under a save that had already read it. */
        <Animated.View
          entering={enterFade(1)}
          style={styles.form}
          pointerEvents={isLoading ? "none" : "auto"}
          onLayout={(e) => {
            formY.current = e.nativeEvent.layout.y;
          }}
        >
          {/* Type Selection */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("selectType")} *
          </Text>
          <View style={[styles.typeContainer, isRTL && styles.typeContainerRTL]}>
            {LODGING_TYPES.map((item) => {
              const on = shownType === item.value;
              return (
                <Pressable
                  key={item.value}
                  style={({ pressed }) => [
                    styles.typeButton,
                    on && styles.typeButtonSelected,
                    pressed && styles.pressed,
                  ]}
                  // Tapping the chip that is already lit changes nothing, so a
                  // seeded "luxury_hotel" is not flattened to "hotel" by a tap.
                  onPress={() => {
                    if (!on) set("type", item.value);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.typeButtonText, on && styles.typeButtonTextSelected]}>
                    {t(item.labelKey as any)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Name */}
          <View
            onLayout={(e) => {
              fieldY.current.name = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingName")} *
            </Text>
            <ThemedTextInput
              ref={nameRef}
              style={[styles.input, errors.name && styles.inputError]}
              isRTL={isRTL}
              value={form.name}
              onChangeText={(value) => set("name", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => nameArRef.current?.focus()}
              placeholder={t("placeholderNameEn")}
              placeholderTextColor="#A3A3A3"
            />
            {errors.name && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.name)}</Text>
            )}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.nameAr = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("listingNameAr")} *
            </Text>
            <ThemedTextInput
              ref={nameArRef}
              style={[styles.input, errors.nameAr && styles.inputError]}
              isRTL={true}
              value={form.nameAr}
              onChangeText={(value) => set("nameAr", value)}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => neighborhoodRef.current?.focus()}
              placeholder={t("placeholderNameAr")}
              placeholderTextColor="#A3A3A3"
              textAlign="right"
            />
            {errors.nameAr && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.nameAr)}</Text>
            )}
          </View>

          {/* City. Picked, not typed: a typed city is a new city as far as the
              filter is concerned, and "Hofuf" / "hofuf" / "الهفوف" were three
              of them. The Arabic box next to it was never sent anywhere — the
              label now comes from the key. */}
          <View
            onLayout={(e) => {
              fieldY.current.city = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("city")} *
            </Text>
            <View style={[styles.optionGrid, isRTL && styles.optionGridRTL]}>
              {CITIES.map((option) => {
                const on = form.city === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => set("city", option.key)}
                    style={({ pressed }) => [
                      styles.optionChip,
                      on && styles.optionChipOn,
                      pressed && styles.pressed,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={language === "ar" ? option.ar : option.en}
                  >
                    <Text style={[styles.optionLabel, on && styles.optionLabelOn]}>
                      {language === "ar" ? option.ar : option.en}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.city && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>{t(errors.city)}</Text>
            )}
          </View>

          {/* Neighborhood. One box: an Arabic one sat under it for years and
              was never sent anywhere, so what a host typed there vanished. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("neighborhood")}
          </Text>
          <ThemedTextInput
            ref={neighborhoodRef}
            style={[styles.input]}
            isRTL={isRTL}
            value={form.neighborhood}
            onChangeText={(value) => set("neighborhood", value)}
            onFocus={prepareKeyboard}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => priceRangeRef.current?.focus()}
            placeholder={t("placeholderNeighborhoodEn")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Price Range */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("priceRange")}
          </Text>
          <ThemedTextInput
            ref={priceRangeRef}
            style={[styles.input]}
            isRTL={isRTL}
            value={form.priceRange}
            onChangeText={(value) => set("priceRange", value)}
            onFocus={prepareKeyboard}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={() => priceRef.current?.focus()}
            placeholder={t("placeholderPriceLodging")}
            placeholderTextColor="#A3A3A3"
          />

          {/* Booking & pricing. Optional as a group: a host who leaves the
              nightly price blank still gets a listing in the directory, it
              just does not show a Book button. */}
          <Text style={[styles.sectionTitle, isRTL && styles.textRTL]}>
            {t("pricingSectionTitle")}
          </Text>
          <Text style={[styles.sectionHint, isRTL && styles.textRTL]}>
            {t("pricingSectionHint")}
          </Text>

          <View
            onLayout={(e) => {
              fieldY.current.pricePerNight = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>
              {t("pricePerNightLabel")}
            </Text>
            <ThemedTextInput
              ref={priceRef}
              style={[styles.input, errors.pricePerNight && styles.inputError]}
              isRTL={isRTL}
              value={form.pricePerNight}
              onChangeText={setDigits("pricePerNight")}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => guestsRef.current?.focus()}
              placeholder={t("placeholderPricePerNight")}
              placeholderTextColor="#A3A3A3"
              keyboardType="number-pad"
            />
            {errors.pricePerNight ? (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.pricePerNight)}
              </Text>
            ) : cannotClear("pricePerNight") ? (
              <Text style={[styles.clearNote, isRTL && styles.textRTL]}>
                {t("editCannotClear").replace("{value}", `${saved.pricePerNight} ${t("sar")}`)}
              </Text>
            ) : null}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.maxGuests = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t("maxGuestsLabel")}</Text>
            <ThemedTextInput
              ref={guestsRef}
              style={[styles.input, errors.maxGuests && styles.inputError]}
              isRTL={isRTL}
              value={form.maxGuests}
              onChangeText={setDigits("maxGuests")}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => unitsRef.current?.focus()}
              keyboardType="number-pad"
            />
            {errors.maxGuests ? (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.maxGuests)}
              </Text>
            ) : cannotClear("maxGuests") ? (
              <Text style={[styles.clearNote, isRTL && styles.textRTL]}>
                {t("editCannotClear").replace("{value}", saved.maxGuests)}
              </Text>
            ) : null}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.unitCount = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t("unitCountLabel")}</Text>
            <ThemedTextInput
              ref={unitsRef}
              style={[styles.input, errors.unitCount && styles.inputError]}
              isRTL={isRTL}
              value={form.unitCount}
              onChangeText={setDigits("unitCount")}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => checkInRef.current?.focus()}
              keyboardType="number-pad"
            />
            {errors.unitCount ? (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.unitCount)}
              </Text>
            ) : cannotClear("unitCount") ? (
              <Text style={[styles.clearNote, isRTL && styles.textRTL]}>
                {t("editCannotClear").replace("{value}", saved.unitCount)}
              </Text>
            ) : null}
          </View>

          {/* Times stay left-aligned in both languages: "15:00" is a fixed
              pattern, and mirroring it puts the minutes before the hour. */}
          <View
            onLayout={(e) => {
              fieldY.current.checkInTime = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t("checkInTimeLabel")}</Text>
            <ThemedTextInput
              ref={checkInRef}
              style={[styles.input, errors.checkInTime && styles.inputError]}
              isRTL={false}
              value={form.checkInTime}
              onChangeText={setDigits("checkInTime")}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => checkOutRef.current?.focus()}
              placeholder="15:00"
              placeholderTextColor="#A3A3A3"
              keyboardType="numbers-and-punctuation"
              textAlign="left"
            />
            {errors.checkInTime && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.checkInTime)}
              </Text>
            )}
          </View>

          <View
            onLayout={(e) => {
              fieldY.current.checkOutTime = e.nativeEvent.layout.y;
            }}
          >
            <Text style={[styles.label, isRTL && styles.textRTL]}>{t("checkOutTimeLabel")}</Text>
            <ThemedTextInput
              ref={checkOutRef}
              style={[styles.input, errors.checkOutTime && styles.inputError]}
              isRTL={false}
              value={form.checkOutTime}
              onChangeText={setDigits("checkOutTime")}
              onFocus={prepareKeyboard}
              returnKeyType="next"
              submitBehavior="submit"
              onSubmitEditing={() => descriptionRef.current?.focus()}
              placeholder="12:00"
              placeholderTextColor="#A3A3A3"
              keyboardType="numbers-and-punctuation"
              textAlign="left"
            />
            {errors.checkOutTime && (
              <Text style={[styles.fieldError, isRTL && styles.textRTL]}>
                {t(errors.checkOutTime)}
              </Text>
            )}
          </View>

          {/* Description, in each language under its own label — the Arabic
              box used to sit under the English one's with none. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescription")}
          </Text>
          <ThemedTextInput
            ref={descriptionRef}
            style={[styles.input, styles.textArea]}
            isRTL={isRTL}
            value={form.description}
            onChangeText={(value) => set("description", value)}
            onFocus={prepareKeyboard}
            placeholder={t("placeholderDescriptionEn")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
          />

          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("listingDescriptionAr")}
          </Text>
          <ThemedTextInput
            ref={descriptionArRef}
            style={[styles.input, styles.textArea]}
            isRTL={true}
            value={form.descriptionAr}
            onChangeText={(value) => set("descriptionAr", value)}
            onFocus={prepareKeyboard}
            placeholder={t("placeholderDescriptionAr")}
            placeholderTextColor="#A3A3A3"
            multiline
            numberOfLines={4}
            textAlign="right"
          />

          {/* Amenities. A closed list of toggles: what the host switches on
              here is exactly what a guest sees, icon and all, in both
              languages — which free text could never guarantee. */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("amenities")}
          </Text>
          <Text style={[styles.hint, isRTL && styles.textRTL]}>
            {t("amenitiesHint")}
          </Text>
          <View style={[styles.optionGrid, isRTL && styles.optionGridRTL]}>
            {AMENITIES.map((amenity) => {
              const on = form.amenities.includes(amenity.key);
              return (
                <Pressable
                  key={amenity.key}
                  onPress={() => toggleAmenity(amenity.key)}
                  style={({ pressed }) => [
                    styles.optionChip,
                    isRTL && styles.rowRTL,
                    on && styles.optionChipOn,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={language === "ar" ? amenity.ar : amenity.en}
                >
                  <Feather
                    name={amenity.icon}
                    size={14}
                    color={on ? colors.ink : colors.onSurface.variant}
                  />
                  <Text
                    style={[styles.optionLabel, on && styles.optionLabelOn]}
                  >
                    {language === "ar" ? amenity.ar : amenity.en}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Images */}
          <Text style={[styles.label, isRTL && styles.textRTL]}>
            {t("addImages")}
          </Text>
          <PhotoPickerField
            images={form.images}
            onChange={(images) => set("images", images)}
          />

          {/* Submit. `loading` keeps the button's size with a spinner in
              it; the old blank label over a spinner hung below read as a
              broken button. */}
          <Button
            title={isEditing ? t("saveChanges") : t("submitForReview")}
            onPress={handleSubmit}
            fullWidth
            loading={isLoading}
            disabled={saveDisabled}
            style={styles.submitButton}
          />

          {isLoading && (
            <Text style={styles.progressText} accessibilityLiveRegion="polite">
              {progress && progress.done < progress.total
                ? t("uploadingPhotos")
                    .replace("{done}", String(progress.done))
                    .replace("{total}", String(progress.total))
                : t("saving")}
            </Text>
          )}
        </Animated.View>
        )}

        <View style={styles.bottomSpacing} />
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (fonts: AppFonts) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FAF7F2",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerRTL: {
    alignItems: "flex-end",
  },
  title: {
    fontSize: 28,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    letterSpacing: -0.5,
  },
  textRTL: {
    textAlign: "right",
  },
  form: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  // The editor's "still loading" and "nothing to edit" states.
  stateBox: {
    paddingHorizontal: 32,
    paddingTop: 56,
    alignItems: "center",
    gap: 8,
  },
  stateTitle: {
    fontSize: 18,
    fontFamily: fonts.semibold,
    color: colors.ink,
    textAlign: "center",
  },
  stateBody: {
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    lineHeight: 20,
    textAlign: "center",
  },
  stateButton: {
    marginTop: 16,
    alignSelf: "stretch",
  },
  label: {
    fontSize: 14,
    fontFamily: fonts.semibold,
    color: "#1A1A1A",
    marginBottom: 8,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: fonts.bold,
    color: "#1A1A1A",
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: "#E5E5E5",
  },
  sectionHint: {
    fontSize: 13,
    fontFamily: fonts.regular,
    color: "#737373",
    lineHeight: 19,
    marginTop: 6,
  },
  // A notice, not an error: the save still goes through.
  clearNote: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.onSurface.variant,
    lineHeight: 18,
    marginTop: 6,
  },
  // The destructive text token: 5.2:1 on the cream page.
  fieldError: {
    fontSize: 12.5,
    fontFamily: fonts.medium,
    color: colors.signOut,
    lineHeight: 18,
    marginTop: 6,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: "#1A1A1A",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  inputError: {
    borderColor: colors.signOut,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  typeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  typeContainerRTL: {
    flexDirection: "row-reverse",
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E5E5",
  },
  typeButtonSelected: {
    backgroundColor: "#CCE745",
    borderColor: "#CCE745",
  },
  typeButtonText: {
    fontSize: 14,
    color: "#737373",
    fontFamily: fonts.medium,
  },
  typeButtonTextSelected: {
    color: "#1F1D17",
  },
  pressed: {
    opacity: 0.7,
  },
  submitButton: {
    marginTop: 24,
  },
  progressText: {
    marginTop: 12,
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
    textAlign: "center",
  },
  editNotice: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginTop: 6,
    lineHeight: 18,
  },
  bottomSpacing: {
    height: 32,
  },
  hint: {
    fontSize: 12.5,
    fontFamily: fonts.regular,
    color: colors.onSurface.muted,
    marginTop: -4,
    marginBottom: 10,
  },
  rowRTL: {
    flexDirection: "row-reverse",
  },
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  optionGridRTL: {
    flexDirection: "row-reverse",
  },
  // Off is the same white pill the filter chips use; on is lime, and lime is a
  // fill, so the label and the icon on it are ink.
  optionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: colors.surface.DEFAULT,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  optionChipOn: {
    backgroundColor: colors.primary.DEFAULT,
    borderColor: colors.primary.DEFAULT,
  },
  optionLabel: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.onSurface.variant,
  },
  optionLabelOn: {
    color: colors.ink,
    fontFamily: fonts.semibold,
  },
});
