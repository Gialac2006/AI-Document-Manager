import type { ButtonHTMLAttributes } from "react";

const variantClasses = {
  primary: "primary-button",
  secondary: "secondary-button",
  danger: "danger-button",
  text: "text-button",
};

type ButtonVariant = keyof typeof variantClasses;

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export default function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${variantClasses[variant]} ${className}`.trim()}
      {...props}
    />
  );
}
