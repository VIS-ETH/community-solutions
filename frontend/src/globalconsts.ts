enum ZIndex {
  imageOverlay = 42,
  panel = 101,
}
export default {
  dateFNSFormatString: "dd.MM.yyyy HH:mm",
  dateFNSFormatStringDate: "dd.MM.yyyy",
  mediaSmall: "@media (max-width: 599px)",
  mediaMedium: "@media (max-width: 799px)",
  zIndex: ZIndex,
} as const;
