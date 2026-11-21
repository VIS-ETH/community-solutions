import React, { useCallback, useRef, useState } from "react";

type KeysWhereValue<T, S> = {
  [K in keyof T]: T[K] extends S ? K : never;
}[keyof T];
type FormData = Record<string, unknown>;
interface InputElement<T> {
  value: T;
  defaultValue: T;
}
interface CheckedElement {
  checked: boolean;
  defaultChecked: boolean;
}
type ResetFnMap<T extends FormData> = {
  [name in keyof T]?: () => void;
};
/**
 * A hook which can be used to manage a form that consists of
 * both uncontrolled and controlled input elements. Uncontrolled
 * input elements are generally preferred.
 * @param initialData The initial data the form should be populated
 * with. Include keys that are initially undefined as this value
 * will be used to infer the form data type.
 * @param formSubmit An optional callback that is invoked with the
 * current data when the returned onSubmit is invoked.
 * @example
 * const {
 *   registerInput,
 *   registerCheckbox,
 *   onSubmit
 * } = useForm<{name: string, password: string}>({
 *     name: "",
 *     password: "",
 *   },
 *   ({name, password}) =>
 *     login(name, password)
 * );
 */
const useForm = <FormTypes extends FormData>(
  initialData: FormTypes,
  formSubmit?: (data: FormTypes, reset: () => void) => void,
) => {
  const ref = useRef({ ...initialData });
  const [state, setState] = useState<FormTypes>({ ...initialData });
  const resetFnMapRef = useRef<ResetFnMap<FormTypes>>({});
  const setValue = useCallback(
    <A extends keyof FormTypes>(name: A, value: FormTypes[A]) => {
      ref.current[name] = value;
    },
    [],
  );
  const onChangeTransform = useCallback(
    <B extends keyof FormTypes, M>(
      name: B,
      e: React.ChangeEvent<M>,
      transform: (val: M) => FormTypes[B],
    ) => {
      setValue(name, transform(e.target));
    },
    [setValue],
  );
  const setStateValue = useCallback(
    <Key extends keyof FormTypes>(key: Key, value: FormTypes[Key]) => {
      setValue(key, value);
      setState(prevState => ({ ...prevState, [key]: value }));
    },
    [setValue],
  );
  const register = useCallback(
    <Type, M, S>(
      name: KeysWhereValue<FormTypes, Type>,
      transform: (val: M) => Type,
      valueTransform: (val: Type) => S,
    ) => {
      const handler = (e: React.ChangeEvent<M>) =>
        onChangeTransform(
          name,
          e,
          transform as (val: M) => FormTypes[typeof name],
        );
      return {
        ...valueTransform(ref.current[name] as Type),
        onChange: handler,
      } as const;
    },
    [onChangeTransform],
  );

  const registerTextInput = useCallback(
    (name: KeysWhereValue<FormTypes, string>) => {
      return register<
        string,
        InputElement<string>,
        Partial<InputElement<string>>
      >(
        name,
        e => {
          resetFnMapRef.current[name] = () => {
            e.value = initialData[name] as string;
          };

          return e.value;
        },
        v => ({
          defaultValue: v,
        }),
      );
    },
    [register, initialData],
  );

  const registerCheckbox = useCallback(
    (name: KeysWhereValue<FormTypes, boolean>) => {
      return register<boolean, CheckedElement, Partial<CheckedElement>>(
        name,
        e => {
          resetFnMapRef.current[name] = () => {
            e.checked = initialData[name] as boolean;
          };

          return e.checked;
        },
        v => ({ defaultChecked: v }),
      );
    },
    [register, initialData],
  );

  const reset = useCallback(() => {
    ref.current = { ...initialData };
    for (const key in resetFnMapRef.current) {
      if (Object.prototype.hasOwnProperty.call(resetFnMapRef.current, key)) {
        const fn = resetFnMapRef.current[key];
        if (fn) fn();
      }
    }
    resetFnMapRef.current = {};
    setState({ ...initialData });
  }, [initialData]);

  const onSubmit = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (formSubmit) formSubmit(ref.current, reset);
    },
    [formSubmit, reset],
  );

  return {
    reset,

    registerTextInput,
    registerCheckbox,

    formState: state,
    setFormValue: setStateValue,

    onSubmit,
  } as const;
};

export default useForm;
