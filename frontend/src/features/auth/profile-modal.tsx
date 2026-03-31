import { useEffect, useState } from "react";

import type { CurrentUser } from "../../entities/user/types";

type ProfileModalProps = {
  currentUser: CurrentUser;
  saving: boolean;
  error: string;
  onClose: () => void;
  onSave: (profile: {
    username: string;
    gender: string;
    city: string;
    phone: string;
    email: string;
  }) => Promise<void>;
};

export function ProfileModal({ currentUser, saving, error, onClose, onSave }: ProfileModalProps) {
  const [username, setUsername] = useState(currentUser.username);
  const [gender, setGender] = useState(currentUser.gender ?? "");
  const [city, setCity] = useState(currentUser.city ?? "");
  const [phone, setPhone] = useState(currentUser.phone ?? "");
  const [email, setEmail] = useState(currentUser.email ?? "");

  useEffect(() => {
    setUsername(currentUser.username);
    setGender(currentUser.gender ?? "");
    setCity(currentUser.city ?? "");
    setPhone(currentUser.phone ?? "");
    setEmail(currentUser.email ?? "");
  }, [currentUser.city, currentUser.email, currentUser.gender, currentUser.id, currentUser.phone, currentUser.username]);

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
          {"\u8f93\u5165\u66f4\u591a\u8d44\u6599\u53ef\u4ee5\u63d0\u4f9b\u66f4\u51c6\u786e\u7684\u5efa\u8bae"}
        </p>
        <label className="profile-modal-card__row">
          <span>{"\u7528\u6237\u540d"}</span>
          <input
            maxLength={50}
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
        </label>
        <label className="profile-modal-card__row">
          <span>{"\u6027\u522b"}</span>
          <select onChange={(event) => setGender(event.target.value)} value={gender}>
            <option value="">{"\u8bf7\u9009\u62e9"}</option>
            <option value={"\u7537"}>{"\u7537"}</option>
            <option value={"\u5973"}>{"\u5973"}</option>
            <option value={"\u4e0d\u544a\u8bc9\u4f60"}>{"\u4e0d\u544a\u8bc9\u4f60"}</option>
          </select>
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
              void onSave({ username, gender, city, phone, email });
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
