import { useEffect, useLayoutEffect, useRef, useState } from "react";

type DropdownActionOption = {
  value: string;
  label: string;
};

type DropdownActionProps = {
  className?: string;
  disabled?: boolean;
  fixedWidth?: string;
  label: string;
  onSelect: (value: string) => void | Promise<void>;
  options: DropdownActionOption[];
  selectedLabel?: string;
  selectedValue?: string | null;
};

export function DropdownAction({
  className,
  disabled = false,
  fixedWidth,
  label,
  onSelect,
  options,
  selectedLabel,
  selectedValue,
}: DropdownActionProps) {
  // 这个组件负责把“一个按钮 + 多个动作”收敛成统一下拉交互。
  const [open, setOpen] = useState(false);
  const [menuDirection, setMenuDirection] = useState<"down" | "up">("down");
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      // 点击组件外部区域时自动关闭菜单，行为更接近原生下拉框。
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !rootRef.current || !menuRef.current) {
      return;
    }

    const rootRect = rootRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current.offsetHeight;
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rootRect.bottom;
    const spaceAbove = rootRect.top;
    // 贴近底部时向上展开，避免菜单超出可视区域。
    const shouldOpenUp = spaceBelow < menuHeight + 12 && spaceAbove > spaceBelow;

    setMenuDirection(shouldOpenUp ? "up" : "down");
  }, [open, options.length]);

  return (
    <div
      className={`dropdown-action${fixedWidth ? " dropdown-action--fixed" : ""}${className ? ` ${className}` : ""}`}
      ref={rootRef}
      style={fixedWidth ? { width: fixedWidth } : undefined}
    >
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        className="dropdown-action__trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span className="dropdown-action__label">{selectedLabel ?? label}</span>
        <span className={`dropdown-action__caret${open ? " dropdown-action__caret--open" : ""}`} />
      </button>
      {open ? (
        <div
          className={`dropdown-action__menu${menuDirection === "up" ? " dropdown-action__menu--up" : ""}`}
          ref={menuRef}
          role="menu"
        >
          {options.map((option) => (
            <button
              className={`dropdown-action__option${selectedValue === option.value ? " dropdown-action__option--active" : ""}`}
              key={option.value}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpen(false);
                void onSelect(option.value);
              }}
              role="menuitem"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
