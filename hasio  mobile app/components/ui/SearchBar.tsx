import React from "react";
import { View, TextInput, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";

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
      <TextInput
        style={[styles.input, isRTL && styles.inputRTL]}
        placeholder={placeholder}
        placeholderTextColor="#0D7A5F"
        value={value}
        onChangeText={onChangeText}
        textAlign={isRTL ? "right" : "left"}
      />
      {value.length > 0 && (
        <Pressable
          onPress={() => onChangeText("")}
          style={styles.clearButton}
          hitSlop={8}
        >
          <Feather name="x-circle" size={18} color="#A3A3A3" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 2,
    shadowColor: "#0D7A5F",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 1,
    borderColor: "rgba(13, 122, 95, 0.15)",
  },
  containerRTL: {
    flexDirection: "row-reverse",
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#1A1A1A",
    paddingVertical: 10,
    fontWeight: "400",
  },
  inputRTL: {
    writingDirection: "rtl",
  },
  clearButton: {
    paddingLeft: 8,
  },
});
