function el(tag: string, className = "", children: HTMLElement[] = [], attrs: Record<string, string> = {}) {
    const e = document.createElement(tag);
    e.className = className;
    for (const [k, v] of Object.entries(attrs)) {
      e.setAttribute(k, v);
    }
    children.forEach(child => e.appendChild(child));
    return e;
  }
  
  function renderSignIn() {
    const container = el("div", "flex flex-col items-center justify-start min-h-auto max-w-[400px] mx-auto my-[50px] gap-[30px]", [
      el("h2", "m-0 p-0", [], { innerText: "Sign in" }),
  
      el("input", "w-[300px] text-[16px] border-2 border-white bg-black text-white rounded-lg", [], {
        type: "text",
        placeholder: "Username",
      }),
  
      el("input", "w-[300px] text-[16px] border-2 border-white bg-black text-white rounded-lg", [], {
        type: "password",
        placeholder: "Password",
      }),
  
      el("button", "static transform-none m-0 p-0 bg-none border-none outline-none text-[#192fcf] no-underline text-inherit font-inherit hover:text-[#aa3cff] hover:bg-black", [], {
        id: "signInBtn",
        innerText: "SIGN IN",
      }),
  
      el("p", "", [
        document.createTextNode("Don't have an account? "),
        el("a", "text-[#192fcf] no-underline text-inherit font-inherit hover:text-[#aa3cff] hover:bg-black", [], {
          href: "#",
          id: "signUpBtn",
          innerText: "Sign up",
        }),
      ]),
    ]);
  
    const root = document.getElementById("app");
    root?.replaceChildren(container);
  }