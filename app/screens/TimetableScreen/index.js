/* eslint class-methods-use-this: 0 */
import React, { Component } from "react";
import { RefreshControl, View } from "react-native";
import { Permissions, Notifications } from "expo";
import { connect } from "react-redux";
import { NavigationActions } from "react-navigation";
import PropTypes from "prop-types";
import { Feather } from "@expo/vector-icons";
import moment from "moment";
import { fetchTimetable } from "../../actions/timetableActions";
import { TIMETABLE_CACHE_TIME_HOURS } from "../../constants/timetableConstants";
import { TitleText, BodyText, SubtitleText } from "../../components/Typography";
import { MainTabPage } from "../../components/Containers";
import Button from "../../components/Button";
import { TextInput } from "../../components/Input";
import Colors from "../../constants/Colors";
import TimetableComponent from "./TimetableComponent";
import DateControls from "./DateControls";

class TimetableScreen extends Component {
  static navigationOptions = {
    header: null,
    tabBarIcon: ({ focused }) => (
      <Feather
        name="calendar"
        size={28}
        color={focused ? Colors.pageBackground : Colors.textColor}
      />
    ),
  };

  static propTypes = {
    navigation: PropTypes.shape().isRequired,
    user: PropTypes.shape(),
    timetable: PropTypes.shape(),
    error: PropTypes.string,
    fetchTimetable: PropTypes.func,
    isFetchingTimetable: PropTypes.bool,
  };

  static defaultProps = {
    user: {},
    timetable: {},
    error: "",
    fetchTimetable: () => {},
    isFetchingTimetable: false,
  };

  static mapStateToProps = state => ({
    user: state.user,
    timetable: state.timetable.timetable,
    isFetchingTimetable: state.timetable.isFetching,
    error: state.timetable.error,
  });

  static mapDispatchToProps = dispatch => ({
    fetchTimetable: (token, date) => dispatch(fetchTimetable(token, date)),
  });

  constructor(props) {
    super(props);
    this.state = {
      date: moment().startOf("day"),
      token: "",
    };
  }

  componentDidMount() {
    if (this.loginCheck(this.props) && this.props.user.token !== "") {
      this.props.fetchTimetable(this.props.user.token, this.state.date);
    }

    this.registerForPushNotificationsAsync();
  }

  async onDateChanged(newDate, forceUpdate = false) {
    const newDay = newDate.startOf("day");
    await this.setState({
      date: newDay,
    });
    const dateString = newDay.format("YYYY-MM-DD");
    if (
      forceUpdate ||
      !this.props.timetable[dateString] ||
      !this.props.timetable[dateString].lastUpdated
    ) {
      this.props.fetchTimetable(this.props.user.token, this.state.date);
    } else {
      const diff = moment.duration(
        moment().diff(this.props.timetable[dateString].lastUpdated),
      );
      if (diff.asHours() > TIMETABLE_CACHE_TIME_HOURS) {
        this.props.fetchTimetable(this.props.user.token, this.state.date);
      }
    }
  }

  async registerForPushNotificationsAsync() {
    const { status: existingStatus } = await Permissions.getAsync(
      Permissions.NOTIFICATIONS,
    );
    let finalStatus = existingStatus;

    // only ask if permissions have not already been determined, because
    // iOS won't necessarily prompt the user a second time.
    if (existingStatus !== "granted") {
      // Android remote notification permissions are granted during the app
      // install, so this will only ask on iOS
      const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
      finalStatus = status;
    }

    // Stop here if the user did not grant permissions
    if (finalStatus !== "granted") {
      return;
    }

    // Get the token that uniquely identifies this device
    this.setState({ token: await Notifications.getExpoPushTokenAsync() });
  }

  loginCheck(props) {
    if (Object.keys(props.user).length > 0) {
      if (props.user.scopeNumber < 0) {
        this.props.navigation.dispatch(
          NavigationActions.reset({
            index: 0,
            actions: [NavigationActions.navigate({ routeName: "Splash" })],
          }),
        );
        return false;
      }
    }
    return true;
  }

  render() {
    const { navigate } = this.props.navigation;
    const { user, timetable, isFetchingTimetable } = this.props;
    const { scopeNumber } = user;
    const { date, token } = this.state;
    const dateString = date.format("dddd, Do MMMM");
    return (
      <MainTabPage
        refreshControl={
          <RefreshControl
            refreshing={isFetchingTimetable}
            onRefresh={() => this.onDateChanged(date, true)}
          />
        }
      >
        {scopeNumber < 0 && (
          <View>
            <BodyText>You are not signed in.</BodyText>
            <Button onPress={() => navigate("Splash")}>Sign In</Button>
          </View>
        )}
        <TitleText>{dateString}</TitleText>
        <DateControls date={date} onDateChanged={d => this.onDateChanged(d)} />
        <TimetableComponent
          timetable={timetable}
          date={date}
          isLoading={isFetchingTimetable}
          navigation={this.props.navigation}
        />
        {!date.isSame(moment().startOf("day")) && (
          <Button onPress={() => this.onDateChanged(moment())}>
            Jump To Today
          </Button>
        )}
        <TextInput value={token} />

        {/* <SubtitleText>Find A Timetable</SubtitleText>
        <TextInput placeholder="Search for a course or module..." /> */}
      </MainTabPage>
    );
  }
}

export default connect(
  TimetableScreen.mapStateToProps,
  TimetableScreen.mapDispatchToProps,
)(TimetableScreen);
