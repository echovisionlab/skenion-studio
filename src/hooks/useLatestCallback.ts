import { useCallback, useEffect, useRef } from "react";

export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
}

export function useLatestCallback<TArgs extends unknown[], TResult>(
  callback: ((...args: TArgs) => TResult) | undefined
) {
  const callbackRef = useLatestRef(callback);
  return useCallback((...args: TArgs) => callbackRef.current?.(...args), [callbackRef]);
}
