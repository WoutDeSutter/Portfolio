import type { CSSProperties } from 'react';
import { pause, play, setVolume, stop } from '../audio/music';
import { useMusic } from '../audio/useMusic';
import { Panel } from '../components/Panel';
import { tracks } from '../content/content';
import {
  LIGHT_COLORS,
  LIGHT_COLOR_IDS,
  LIGHT_MODES,
  setLightMode,
  toggleLightColor,
  useLights,
} from '../festival/lights';
import { useTextVersion } from '../festival/TextVersionContext';
import { useTranslation } from '../i18n/useTranslation';

/**
 * The FOH desk, the easter egg: pick a track for the stage speakers and run the stage lights.
 * In the 3D festival that happens on the desk screens; the same controls are here as HTML for
 * keyboard and screen-reader users, folded away so the panel stays free. Music only ever starts
 * from a click.
 */
export function FohPanel() {
  const { t } = useTranslation();
  const music = useMusic();
  const lights = useLights();
  // Without the 3D festival there are no stage lights (or positional speakers) to control.
  const textVersion = useTextVersion();

  const controls = (
    <>
      <section className="panel-section" aria-labelledby="foh-music">
        <h2 id="foh-music" className="panel-section__title label">
          {t('foh.music')}
        </h2>
        {tracks.length === 0 ? (
          <p className="panel-empty">{t('foh.noTracks')}</p>
        ) : (
          <ul className="tracks" role="list">
            {tracks.map((track) => {
              const current = music.track?.id === track.id;
              const playing = current && music.playing;
              return (
                <li key={track.id}>
                  {/* aria-pressed tells screen readers whether this track is playing. */}
                  <button
                    type="button"
                    className={current ? 'tracks__track tracks__track--current' : 'tracks__track'}
                    aria-pressed={playing}
                    onClick={() => (playing ? pause() : play(track))}
                  >
                    <span className="tracks__title">{track.title}</span>
                    <span className="tracks__artist">{track.artist}</span>
                    <span className="tracks__state label" aria-hidden="true">
                      {playing ? '❚❚' : '▶'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <label className="volume">
          <span className="label">{t('foh.volume')}</span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(music.volume * 100)}
            onChange={(event) => setVolume(Number(event.target.value) / 100)}
          />
          <span className="volume__value label" aria-hidden="true">
            {Math.round(music.volume * 100)}%
          </span>
        </label>

        {music.track && (
          <div className="now-playing">
            <p className="label" aria-live="polite">
              {music.playing ? t('foh.nowPlaying') : t('foh.paused')}: {music.track.title} — {music.track.artist}
            </p>
            <p className="now-playing__credit">{music.track.credit}</p>
            <div className="now-playing__controls">
              <button type="button" className="button" onClick={() => (music.playing ? pause() : play(music.track!))}>
                {music.playing ? t('foh.pause') : t('foh.play')}
              </button>
              <button type="button" className="button" onClick={stop}>
                {t('foh.stop')}
              </button>
            </div>
          </div>
        )}
      </section>

      {!textVersion && (
        <section className="panel-section" aria-labelledby="foh-lights">
          <h2 id="foh-lights" className="panel-section__title label">
            {t('foh.lights')}
          </h2>
          <div className="presets" role="group" aria-label={t('foh.modeLabel')}>
            {LIGHT_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                className={mode === lights.mode ? 'button button--accent' : 'button'}
                aria-pressed={mode === lights.mode}
                onClick={() => setLightMode(mode)}
              >
                {t(`foh.modes.${mode}`)}
              </button>
            ))}
          </div>
          <div className="swatches" role="group" aria-label={t('foh.colors')}>
            {LIGHT_COLOR_IDS.map((color) => (
              <button
                key={color}
                type="button"
                className="swatch"
                style={{ '--swatch': LIGHT_COLORS[color] } as CSSProperties}
                aria-pressed={lights.colors.includes(color)}
                onClick={() => toggleLightColor(color)}
              >
                <span className="visually-hidden">{t(`foh.colorNames.${color}`)}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </>
  );

  return (
    <Panel title={t('places.foh')}>
      <p className="panel-intro">{t('foh.intro')}</p>
      {textVersion ? (
        controls
      ) : (
        <>
          <p>{t('foh.desks')}</p>
          {tracks.length > 0 && <p className="panel-intro">{t('foh.tip')}</p>}
          {/* <details> is a native, keyboard-accessible fold-out: closed until opened. */}
          <details className="foh-controls">
            <summary className="label">{t('foh.keyboardControls')}</summary>
            <div className="foh-controls__content">{controls}</div>
          </details>
        </>
      )}
    </Panel>
  );
}
