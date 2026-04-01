import { useEffect, useState } from "react";

import type { CurrentUser } from "../../entities/user/types";
import { DropdownAction } from "../../shared/ui/dropdown-action";

type ProfileModalProps = {
  currentUser: CurrentUser;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (profile: {
    username: string;
    gender: string;
    age: string;
    city: string;
    phone: string;
    email: string;
  }) => Promise<void>;
};

export function ProfileModal({ currentUser, saving, error, onClose, onSave }: ProfileModalProps) {
  const genderOptions = [
    { value: "\u7537", label: "\u7537" },
    { value: "\u5973", label: "\u5973" },
    { value: "\u4e0d\u544a\u8bc9\u4f60", label: "\u4e0d\u544a\u8bc9\u4f60" },
  ];
  const [username, setUsername] = useState(currentUser.username);
  const [gender, setGender] = useState(currentUser.gender ?? "");
  const [age, setAge] = useState(currentUser.age != null ? String(currentUser.age) : "");
  const [city, setCity] = useState(currentUser.city ?? "");
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [email, setEmail] = useState(currentUser.email ?? "");

  useEffect(() => {
    setUsername(currentUser.username);
    setGender(currentUser.gender ?? "");
    setAge(currentUser.age != null ? String(currentUser.age) : "");
    setCity(currentUser.city ?? "");
    setPhone(currentUser.phone ?? "");
    setEmail(currentUser.email ?? "");
  }, [currentUser.age, currentUser.city, currentUser.email, currentUser.gender, currentUser.id, currentUser.phone, currentUser.username]);

  return (
    <div aria-modal="true" className="profile-modal-overlay" onClick={onClose} role="dialog">
      <section className="profile-modal-card" onClick={(event) => event.stopPropagation()}>
        <button
          aria-label={"\u5173\u95ed\u4e2a\u4eba\u8d44\u6599\u5f39\u7a97"}
          className="profile-modal-card__close"
          onClick={onClose}
          type="button"
        >
          {"\u00d7"}
        </button>
        <h2 className="profile-modal-card__title">{"\u4e2a\u4eba\u8d44\u6599"}</h2>
        <p className="profile-modal-card__hint">
          {"\u8f93\u5165\u66f4\u591a\u8d44\u6599\u6709\u52a9\u4e8eAI\u63d0\u4f9b\u66f4\u51c6\u786e\u7684\u5efa\u8bae"}
        </p>
        <label className="profile-modal-card__row">
          <span>{"\u7528\u6237\u540d"}</span>
          <input
            disabled
            maxLength={50}
            readOnly
            value={username}
          />
        </label>
        <label className="profile-modal-card__row">
          <span>{"\u6027\u522b"}</span>
          <DropdownAction
            className="dropdown-action--full profile-modal-dropdown"
            label={"\u8bf7\u9009\u62e9"}
            onSelect={(value) => setGender(value)}
            options={genderOptions}
            selectedLabel={gender || "\u8bf7\u9009\u62e9"}
            selectedValue={gender || null}
          />
        </label>
        <label className="profile-modal-card__row">
          <span>{"\u5e74\u9f84"}</span>
          <input
            inputMode="numeric"
            maxLength={3}
            onChange={(event) => setAge(event.target.value.replace(/[^\d]/g, "").slice(0, 3))}
            placeholder={"\u9009\u586b"}
            value={age}
          />
        </label>
        <label className="profile-modal-card__row">
          <span>{"\u57ce\u5e02"}</span>
          <input
            maxLength={100}
            onChange={(event) => setCity(event.target.value)}
            placeholder={"\u9009\u586b"}
            value={city}
          />
        </label>
        <label className="profile-modal-card__row">
          <span>{"\u624b\u673a"}</span>
          <input
            maxLength={30}
            onChange={(event) => setPhone(event.target.value)}
            placeholder={"\u9009\u586b"}
            value={phone}
          />
        </label>
        <label className="profile-modal-card__row">
          <span>{"\u90ae\u7bb1"}</span>
          <input
            maxLength={255}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={"\u9009\u586b"}
            value={email}
          />
        </label>
        {error ? <p className="profile-modal-card__error">{error}</p> : null}
        <div className="profile-modal-card__actions">
          <button
            className="shell__nav-button shell__nav-button--active"
            disabled={saving}
            onClick={() => {
              void onSave({ username, gender, age, city, phone, email });
            }}
            type="button"
          >
            {saving ? "\u4fdd\u5b58\u4e2d" : "\u4fdd\u5b58"}
          </button>
        </div>
      </section>
    </div>
  );
}
