import { createContext, useContext } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';

/**
 * G35, Paso 0: la letra de la app es Nunito (una sola familia, redondeada y
 * tranquila). Con fuentes cargadas por archivo, `fontWeight` no elige el
 * archivo correcto (en Android cae en la del sistema), así que cada grosor
 * tiene su propio nombre. Estos `Text` / `TextInput` traducen el `fontWeight`
 * del estilo al nombre de la fuente; el resto del código sigue usando
 * `fontWeight` como siempre.
 */
export const FUENTES = {
  '400': 'Nunito_400Regular',
  '500': 'Nunito_500Medium',
  '600': 'Nunito_600SemiBold',
  '700': 'Nunito_700Bold',
  '800': 'Nunito_800ExtraBold',
  '900': 'Nunito_900Black',
} as const;

function fuenteDe(peso: TextStyle['fontWeight']): string {
  const p = peso === 'bold' ? '700' : peso === 'normal' || peso == null ? '400' : String(peso);
  return FUENTES[p as keyof typeof FUENTES] ?? FUENTES['400'];
}

/** Estilo con la fuente del grosor pedido. Si ya trae `fontFamily`, se respeta. */
function conFuente(style: TextProps['style'], dentroDeTexto: boolean): TextProps['style'] {
  const plano = (StyleSheet.flatten(style) ?? {}) as TextStyle;
  if (plano.fontFamily) return style;
  // Un texto anidado sin grosor propio hereda la fuente del que lo contiene.
  if (dentroDeTexto && plano.fontWeight == null) return style;
  return { ...plano, fontFamily: fuenteDe(plano.fontWeight), fontWeight: 'normal' };
}

const DentroDeTexto = createContext(false);

export function Text(props: TextProps & { ref?: React.Ref<RNText> }) {
  const dentro = useContext(DentroDeTexto);
  const texto = <RNText {...props} style={conFuente(props.style, dentro)} />;
  return dentro ? texto : <DentroDeTexto.Provider value>{texto}</DentroDeTexto.Provider>;
}

export function TextInput(props: TextInputProps & { ref?: React.Ref<RNTextInput> }) {
  return <RNTextInput {...props} style={conFuente(props.style, false)} />;
}

/** Para estilos que no pasan por `Text` (títulos de la barra superior y de las pestañas). */
export const fuente = (peso: TextStyle['fontWeight'] = '400') => ({ fontFamily: fuenteDe(peso) });
