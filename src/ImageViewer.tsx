import React, { PureComponent } from 'react';
import { PanelProps, FieldType, dateTime, DataFrame } from '@grafana/data';
import { SimpleOptions } from 'types';
import { css } from 'emotion';
import { stylesFactory, Modal } from '@grafana/ui';
import { StreamHandler } from 'mjpeg';

interface ImageInfo {
  time: number; // ms
  percent: number; // 0-1
  image: string;
}

interface Props extends PanelProps<SimpleOptions> {}

interface State {
  selected?: ImageInfo;
  stream?: DataFrame;
}

export class ImageViewer extends PureComponent<Props, State> {
  state: State = {};
  stream: StreamHandler;

  constructor(props: Props) {
    super(props);
    this.stream = new StreamHandler(this.onCameraUpdate);
  }

  componentDidMount() {
    this.checkStream();
  }

  onCameraUpdate = (images: DataFrame) => {
    const { source } = this.props.options;
    if (source === 'stream') {
      this.setState({ stream: images });
    } else {
      this.setState({ stream: undefined });
      this.stream.close();
    }
  };

  componentDidUpdate(old: Props) {
    const { source, imageUrl } = this.props.options;
    if (source !== old.options.source || imageUrl !== old.options.imageUrl) {
      this.checkStream();
    }
  }

  checkStream = () => {
    const { source, imageUrl } = this.props.options;
    if (source === 'stream' && imageUrl) {
      this.stream.open(imageUrl);
    } else {
      this.stream.close();
    }
  };

  onClick = (img?: ImageInfo) => {
    this.setState({ selected: img });
  };

  render() {
    const { options, data, width } = this.props;
    const { selected } = this.state;
    const styles = getStyles();
    console.log(styles);

    const images: ImageInfo[] = [];

    const { timeRange } = data;
    let frames = data.series;
    let min = timeRange.from.valueOf();
    let max = timeRange.to.valueOf();
    if (options.source === 'stream') {
      const {stream} = this.state;
      frames = stream ? [stream] : [];
    }

    // Find the data
    for (const frame of frames) {
      const timeField = frame.fields.find(f => f.type === FieldType.time);
      const stringField = frame.fields.find(f => f.type === FieldType.string);
      if (timeField && stringField) {
        for (let i = 0; i < stringField.values.length; i++) {
          const time = dateTime(timeField.values.get(i)).valueOf();
          images.push({
            time,
            percent: (time - min) / (max - min),
            image: stringField.values.get(i),
          });
        }
      }
    }

    const thumbWidth = css`
      width: ${options.thumbWidth}px;
    `;
    return (
      <div className={styles.wrapper}>
        {images.map(info => {
          const style: any = {};
          const classes = [thumbWidth, styles.thumb];
          if (options.mode === 'timeline') {
            const left = info.percent * (width - options.thumbWidth);
            style.left = `${left}px`;
            classes.push(styles.timeline);
          }

          return (
            <img
              key={info.time}
              style={style}
              className={classes.join(' ')}
              src={`data:image/png;charset=utf-8;base64, ${info.image}`}
              onClick={() => this.onClick(info)}
            />
          );
        })}

        <Modal
          className={styles.popup}
          onDismiss={() => this.onClick(undefined)}
          title={
            <div className="modal-header-title">
              {/* <Icon name="exclamation-triangle" size="lg" /> */}
              <span className="p-l-1">{selected?.time}</span>
            </div>
          }
          isOpen={!!selected}
        >
          <div>
            <img src={`data:image/png;charset=utf-8;base64, ${selected?.image}`} />
          </div>
        </Modal>
      </div>
    );
  }
}

const getStyles = stylesFactory(() => {
  return {
    popup: css`
      width: 80vw;
    `,
    wrapper: css`
      position: relative;
    `,
    thumb: css`
      cursor: pointer;
      &:hover {
        border: 2px solid red;
        transform: scale(1.1);
        z-index: 20;
      }
    `,
    timeline: css`
      position: absolute;
      margin-left: auto;
      margin-right: auto;
      display: block;
    `,
  };
});
