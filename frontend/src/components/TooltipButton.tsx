import { useClickAway } from "@umijs/hooks";
import { Button, ButtonProps, Tooltip } from "@vseth/components";
import React, {
  useCallback,
  useState,
  useContext,
  useEffect,
  useMemo,
} from "react";
import useLongPress from "../hooks/useLongPress";
import { DebugContext } from "./Debug";

function detectMobile() {
  const toMatch = [
    /Android/i,
    /webOS/i,
    /iPhone/i,
    /iPad/i,
    /iPod/i,
    /BlackBerry/i,
    /Windows Phone/i,
  ];

  return toMatch.some(toMatchItem => {
    return navigator.userAgent.match(toMatchItem);
  });
}
const isMobile = detectMobile();

export interface TooltipButtonProps extends ButtonProps {
  tooltip?: React.ReactNode;
}
let id = 0;
const TooltipButton: React.FC<TooltipButtonProps> = ({
  tooltip,
  onClick,
  children,
  ...buttonProps
}) => {
  const { displayAllTooltips } = useContext(DebugContext);
  const [open, setState] = useState(false);
  const toggle = useCallback(() => setState(a => !a), []);
  const [buttonId] = useState(() => id++);
  const handle = useCallback(() => isMobile && setState(true), []);
  const handleClick = useMemo(() => onClick ?? (() => {}), [onClick]);
  const longPress = useLongPress(handle, handleClick, isMobile ? 900 : 10_000);
  const ref = useClickAway(() => setState(false));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <>
      <Button {...longPress} id={`btn-${buttonId}`} {...buttonProps}>
        <span ref={ref} /> {children}
        {mounted && tooltip && (
          <Tooltip
            isOpen={open || displayAllTooltips}
            target={`btn-${buttonId}`}
            toggle={() => !isMobile && toggle()}
            delay={{ show: 800, hide: 100 }}
          >
            {tooltip}
          </Tooltip>
        )}
      </Button>
    </>
  );
};
export default TooltipButton;
