import React, { useState } from 'react';
import { TextInput, TextInputProps } from 'react-native';
import { iron } from '../design/iron-theme';

export function IronInput({ style, onFocus, onBlur, accessibilityLabel, placeholder, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} placeholder={placeholder} accessibilityLabel={accessibilityLabel ?? placeholder}
    style={[style, { minHeight: 44 }, focused && { borderColor: iron.focus, borderBottomWidth: 2 }]}
    onFocus={(event) => { setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { setFocused(false); onBlur?.(event); }} />;
}
