import { NavLink } from "react-router-dom";
import { Avatar } from "@/components/ui/Avatar";
import { useAuth } from "@/features/auth/hooks/useAuth";

/** Mobile-only header shortcut to the profile; the desktop sidebar has its own. */
export function ProfileLink() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <NavLink
      to="/perfil"
      aria-label="Mi perfil"
      className={({ isActive }) =>
        `flex size-11 items-center justify-center rounded-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-primary-solid lg:hidden ${
          isActive ? "ring-2 ring-primary-solid ring-offset-2 ring-offset-bg" : ""
        }`
      }
    >
      <Avatar name={user.name} src={user.avatarUrl} size="sm" />
    </NavLink>
  );
}
