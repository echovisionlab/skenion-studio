import markUrl from "../../assets/brand/skenion-logo-tight.svg";
import styles from "./SkenionMark.module.css";

export function SkenionMark() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={styles.mark}
      src={markUrl}
    />
  );
}
