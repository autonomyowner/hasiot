import React from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { colors, fonts } from "@/constants/colors";

interface SearchBarProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  isRTL?: boolean;
}

export function SearchBar({
  placeholder,
  value,
  onChangeText,
  isRTL = false,
}: SearchBarProps) {
  return (
    <View style={[styles.container, isRTL && styles.containerRTL]}>
      <Feather
        name="search"
        size={18}
        color={colors.onSurface.muted}
        style={isRTL ? styles.iconRTL : styles.icon}
      />
      <TextInput
        style={[styles.input, isRTL && styles.inputRTL]}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurface.muted}
        value={value}
        onChangeText={onChangeText}
        textAlign={isRTL ? "right" : "left"}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          style={styles.clearButton}
          hitSlop={8}
        >
          <Feather name="x-circle" size={18} color={colors.onSurface.muted} />
        </Pressable>
      ) : (
        <View style={styles.filterButton}>
          <Feather name="sliders" size={16} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface.DEFAULT,
    borderRadius: 26,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  containerRTL: {
    flexDirection: "row-reverse",
  },
  icon: {
    marginRight: 10,
  },
  iconRTL: {
    marginLeft: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.ink,
    paddingVertical: 8,
    fontFamily: fonts.regular,
    fontWeight: "400",
  },
  inputRTL: {
    writingDirection: "rtl",
  },
  clearButton: {
    paddingHorizontal: 10,
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary.DEFAULT,
    alignItems: "center",
    justifyContent: "center",
  },
});
