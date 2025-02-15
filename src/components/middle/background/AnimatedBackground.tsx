import type { FC } from '../../../lib/teact/teact';
import React, {
  memo, useCallback,
  useEffect,
  useRef,
  useState,
} from '../../../lib/teact/teact';
import { withGlobal } from '../../../global';

import type { ThemeKey } from '../../../types';

import { selectTheme } from '../../../global/selectors';
// @ts-ignore
import fragmentShader from './fragment-shader.glsl';
// @ts-ignore
import vertexShader from './vertex-shader.glsl';

import styles from './AnimatedBackground.module.scss';

type StateProps = {
  theme: ThemeKey;
};

const speed = 0.1;

const colors = {
  light: [
    '#dbddbb',
    '#6ba587',
    '#d5d88d',
    '#88b884',
  ],
  dark: [
    '#253d28',
    '#a59f77',
    '#2d3e36',
    '#7c9461',
  ],
} as const;

const keyPoints = [
  [0.265, 0.582], // 0
  [0.176, 0.918], // 1
  [1 - 0.585, 1 - 0.164], // 0
  [0.644, 0.755], // 1
  [1 - 0.265, 1 - 0.582], // 0
  [1 - 0.176, 1 - 0.918], // 1
  [0.585, 0.164], // 0
  [1 - 0.644, 1 - 0.755], // 1
] as const;

function getTargetPoints(shift: number): [[number, number], [number, number], [number, number], [number, number]] {
  return ([
    [...keyPoints[shift % 8]],
    [...keyPoints[(shift + 2) % 8]],
    [...keyPoints[(shift + 4) % 8]],
    [...keyPoints[(shift + 6) % 8]],
  ]);
}

function hexToVec3(
  hex: string,
): readonly [r: number, g: number, b: number] {
  if (hex.startsWith('#')) {
    hex = hex.slice(1);
  }

  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  return [r, g, b] as const;
}

function loadShader(
  gl: WebGLRenderingContext,
  shaderSource: string,
  shaderType: number,
): WebGLShader {
  const shader = gl.createShader(shaderType)!;
  gl.shaderSource(shader, shaderSource);
  gl.compileShader(shader);
  gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  return shader;
}

function distance(p1: number[], p2: number[]) {
  return Math.sqrt(
    // (p1[0] - p2[0]) * (p1[0] - p2[0]),
    (p1[1] - p2[1]) * (p1[1] - p2[1]),
  );
}

type RenderContext = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  resolutionLoc: WebGLUniformLocation;
  colorsLoc: [
    WebGLUniformLocation, WebGLUniformLocation, WebGLUniformLocation, WebGLUniformLocation,
  ];
  colorsPosLoc: [
    WebGLUniformLocation, WebGLUniformLocation, WebGLUniformLocation, WebGLUniformLocation,
  ];
};

const AnimatedBackground: FC<StateProps> = ({ theme }) => {
  // eslint-disable-next-line no-null/no-null
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [glCtx, setGlCtx] = useState<RenderContext>();
  useEffect(() => {
    if (!canvasRef.current) return;
    const gl = canvasRef.current.getContext('webgl')!;
    if (!gl) {
      throw new Error('WebGL not supported');
    }

    const program = gl.createProgram()!;
    if (!program) {
      throw new Error('Unable to create WebGLProgram');
    }

    const shaders = [
      loadShader(gl, vertexShader, gl.VERTEX_SHADER),
      loadShader(gl, fragmentShader, gl.FRAGMENT_SHADER),
    ];

    for (const shader of shaders) {
      gl.attachShader(program, shader);
    }

    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Unable to initialize the shader program.');
    }

    gl.useProgram(program);

    // look up where the vertex data needs to go.
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');

    // Create a buffer to put three 2d clip space points in
    const positionBuffer = gl.createBuffer();

    // Bind it to ARRAY_BUFFER (think of it as ARRAY_BUFFER = positionBuffer)
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // fill it with 2 triangles that cover clipspace
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1,
        -1, // first triangle
        1,
        -1,
        -1,
        1,
        -1,
        1, // second triangle
        1,
        -1,
        1,
        1,
      ]),
      gl.STATIC_DRAW,
    );

    // Tell WebGL how to convert from clip space to pixels
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    // Tell it to use our program (pair of shaders)
    gl.useProgram(program);

    // Turn on the attribute
    gl.enableVertexAttribArray(positionAttributeLocation);

    // Bind the position buffer.
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

    // Tell the attribute how to get data out of positionBuffer (ARRAY_BUFFER)
    gl.vertexAttribPointer(
      positionAttributeLocation,
      2, // 2 components per iteration
      gl.FLOAT, // the data is 32bit floats
      false, // don't normalize the data
      0, // 0 = move forward size * sizeof(type) each iteration to get the next position
      0, // start at the beginning of the buffer
    );

    setGlCtx({
      gl,
      program,
      resolutionLoc: gl.getUniformLocation(program, 'resolution')!,
      colorsLoc: [
        gl.getUniformLocation(program, 'color1')!,
        gl.getUniformLocation(program, 'color2')!,
        gl.getUniformLocation(program, 'color3')!,
        gl.getUniformLocation(program, 'color4')!,
      ],
      colorsPosLoc: [
        gl.getUniformLocation(program, 'color1Pos')!,
        gl.getUniformLocation(program, 'color2Pos')!,
        gl.getUniformLocation(program, 'color3Pos')!,
        gl.getUniformLocation(program, 'color4Pos')!,
      ],
    });
  }, [canvasRef]);

  const [keyShift, setKeyShift] = useState<number>(0);

  const updateGl = useCallback((colorsPos: [
    [number, number],
    [number, number],
    [number, number],
    [number, number],
  ]) => {
    if (!glCtx) return;
    const {
      gl, resolutionLoc, colorsLoc, colorsPosLoc,
    } = glCtx;

    gl.uniform2fv(resolutionLoc, [gl.canvas.width, gl.canvas.height]);
    for (let i = 0; i < 4; i++) {
      gl.uniform3fv(colorsLoc[i], hexToVec3(colors[theme][i]));
      gl.uniform2fv(colorsPosLoc[i], colorsPos[i]);
    }

    gl.drawArrays(
      gl.TRIANGLES,
      0, // offset
      6, // num vertices to process
    );
  }, [theme, glCtx]);

  const requestRef = useRef<number>();

  const updateTargetColors = useCallback(() => {
    const newKeyShift = ((keyShift + 1) % 8);
    setKeyShift(newKeyShift);
    const colorsPos = getTargetPoints(keyShift);
    const targetColorsPos = getTargetPoints(newKeyShift);

    const animate = () => {
      const shouldRender = colorsPos.map((col, i) => distance(col, targetColorsPos[i])).some((d) => d > 0.01);
      if (!shouldRender) return;

      for (let i = 0; i < 4; i++) {
        colorsPos[i][0] = colorsPos[i][0] * (1 - speed) + targetColorsPos[i][0] * speed;
        colorsPos[i][1] = colorsPos[i][1] * (1 - speed) + targetColorsPos[i][1] * speed;
      }
      updateGl(colorsPos);
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
  }, [keyShift, updateGl]);

  useEffect(() => {
    updateGl(getTargetPoints(keyShift));

    return () => cancelAnimationFrame(requestRef.current!);
    // eslint-disable-next-line react-hooks-static-deps/exhaustive-deps
  }, [updateGl]);

  useEffect(() => {
    const listener = () => {
      updateTargetColors();
    };

    window.addEventListener('animateBackground', listener);

    return () => {
      window.removeEventListener('animateBackground', listener);
    };
  }, [updateTargetColors]);

  return (
    <canvas className={styles.canvas} ref={canvasRef} />
  );
};

export default memo(withGlobal<{}>(
  (global): StateProps => {
    const theme = selectTheme(global);
    return { theme };
  },
)(AnimatedBackground));
