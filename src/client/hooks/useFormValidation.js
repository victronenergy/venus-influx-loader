import { useState, useEffect } from "react";

function useFormValidation(validate) {
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    setIsValid(validate());
  });

  return isValid;
}

export { useFormValidation };

function extractParameterNameAndValue(event) {
  let value =
    event.target.type === "checkbox"
      ? event.target.checked
      : event.target.value;
  // TODO: figure how to better handle this ???
  if (event.target.name === "port") {
    value = Number(value);
  }
  return [event.target.name, value];
}

export { extractParameterNameAndValue };
