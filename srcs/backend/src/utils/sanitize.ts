export function removeHtmlTags(input: string): string
{
  let result = '';
  let insideTag = false;

  for (const char of input)
  {
    if (char === '<')
    {
      insideTag = true;
    }
    else if (char === '>')
    {
      insideTag = false;
    }
    else if (!insideTag)
    {
      result += char;
    }
  }

  return result;
}

export function keepAlphanumericAndUnderscore(input: string): string
{
  let result = '';

  for (const char of input)
  {
    const isLetter = (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
    const isDigit = char >= '0' && char <= '9';
    const isUnderscore = char === '_';

    if (isLetter || isDigit || isUnderscore)
    {
      result += char;
    }
  }

  return result;
}

export function removeAngleBrackets(input: string): string
{
  let result = '';

  for (const char of input)
  {
    if (char !== '<' && char !== '>')
    {
      result += char;
    }
  }

  return result;
}
