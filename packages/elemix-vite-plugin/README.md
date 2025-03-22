# Elemix Vite Plugin

- [x] TS metadata caching - run on build and HMR, use it in transform
- [x] Type checking diagnostics
    - [x] Filter out imports for not imported components
    - [x] Not imported components
- [x] Transformations
    - [x] Transform components from `<AppComp>` => `<app-comp>`, include self closing and self closing components
    - [x] Prevent imports from being tree shaken
        - [x] add side effect import at the end of the file `import './Foo'`

- [] Ideally create 3rd party package to deal with component TS meta data, `lit` has `lit-analyser`
