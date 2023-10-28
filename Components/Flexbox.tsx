import {
  forwardRef,
  type DetailedHTMLProps,
  type HTMLAttributes,
  type PropsWithChildren,
} from "react";

type Props = DetailedHTMLProps<
  HTMLAttributes<HTMLDivElement>,
  HTMLDivElement
> & {
  column?: boolean;
  reverse?: boolean;
  fullWidth?: boolean;
  fullHeight?: boolean;
  fullFlex?: boolean;
  justify?: "start" | "center" | "end" | "between" | "around";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
};

const JUSTIFY_CLASS_MAP = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

const ALIGN_CLASS_MAP = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const Flexbox = forwardRef<HTMLDivElement, PropsWithChildren<Props>>(
  (
    {
      column,
      reverse,
      fullWidth,
      fullHeight,
      fullFlex,
      justify = "start",
      align = "start",
      className,
      children,
      ...divProps
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`flex ${
          column
            ? reverse
              ? "flex-col-reverse"
              : "flex-col"
            : reverse
            ? "flex-row-reverse"
            : "flex-row"
        } ${fullWidth ? "w-full" : ""} ${fullHeight ? "h-full" : ""} ${
          fullFlex ? "flex-1" : ""
        } ${JUSTIFY_CLASS_MAP[justify]} ${ALIGN_CLASS_MAP[align]} ${
          className ?? ""
        }`}
        {...divProps}
      >
        {children}
      </div>
    );
  }
);

Flexbox.displayName = "Flexbox";

export default Flexbox;
