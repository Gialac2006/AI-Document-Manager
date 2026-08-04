const variantClasses = {
  primary: "primary-button",
  secondary: "secondary-button",
  danger: "danger-button",
  text: "text-button",
};

export default function Button({ variant = "primary", className = "", ...props }) {
  return <button className={`${variantClasses[variant]} ${className}`.trim()} {...props} />;
}
