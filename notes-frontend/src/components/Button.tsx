import React from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "white" | "black" | "blue";
  children: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

export default function Button({
  children,
  variant = "blue",
  className,
  fullWidth,
  ...buttonProps
}: ButtonProps) {
  return (
    <button
      {...buttonProps}
      type={buttonProps.type || "button"}
      className={twMerge(
        clsx(
          "cursor-pointer rounded-full py-3 px-6 flex items-center gap-2 transition-all duration-300 ease-in-out transform hover:scale-105 hover:shadow-lg font-medium text-sm",
          {
            "w-full": fullWidth,
            "w-fit": !fullWidth,
            "opacity-50 cursor-not-allowed": buttonProps.disabled,
            "bg-white text-[#171717] hover:bg-gray-100 border border-gray-200":
              variant === "white",
            "bg-[#171717] text-white hover:bg-gray-800":
              variant === "black",
            "bg-[#5FA9DF] text-white hover:bg-[#4A9BCE]":
              variant === "blue",
          },
          className
        )
      )}
      onClick={buttonProps.onClick}
      disabled={buttonProps.disabled}
    >
      {children}
    </button>
  );
}

