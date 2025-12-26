
/*
  Example: "<script>alert('xss')</script>" → "alert('xss')"
  Example: "user<b>name</b>" → "username"
*/
export function removeHtmlTags(input: string): string
{
  let result = '';
  let insideTag = false;

  for (const char of input)
    if (char === '<')
      insideTag = true;
    else if (char === '>')
      insideTag = false;
    else if (!insideTag)
      result += char;

  return result;
}

/*
  Example: "user@name!" → "username"
  Example: "hello-world_123" → "helloworld_123"
*/
export function keepAlphanumericAndUnderscore(input: string): string
{
  let result = '';

  for (const char of input)
  {
    const isLetter = (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    const isDigit = char >= '0' && char <= '9';
    const isUnderscore = char === '_';
    if (isLetter || isDigit || isUnderscore)
      result += char;
  }

  return result;
}
